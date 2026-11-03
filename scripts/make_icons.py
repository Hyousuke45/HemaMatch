"""Generate HemaMatch app icons (public/icon-192.png, public/icon-512.png).

Brand mark: the same gold droplet used in the header logo and favicon
(path `M12 2C12 2 5 10.3 5 15a7 7 0 0 0 14 0C19 10.3 12 2 12 2Z` on a
24-unit grid), solid #c1912f on a #000000 background — matches the v3
all-black theme. Rendered at 8x supersampling and downscaled with Lanczos
for smooth edges. Replace the two PNGs any time to rebrand the app.
"""
import math
import os

from PIL import Image, ImageDraw

GOLD = (193, 145, 47, 255)   # #c1912f
BLACK = (0, 0, 0, 255)       # #000000

PUBLIC = '/home/z/my-project/public'


def bezier(p0, p1, p2, p3, n=48):
    """Sample a cubic bezier into n+1 points."""
    pts = []
    for i in range(n + 1):
        t = i / n
        mt = 1 - t
        x = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
        y = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def droplet(scale):
    """Brand droplet polygon: apex, left bezier, bottom arc, right bezier."""
    left = bezier((12, 2), (12, 2), (5, 10.3), (5, 15))
    arc = []
    for i in range(65):  # 180deg -> 0deg through the bottom point (12, 22)
        a = math.pi - (math.pi * i / 64)
        arc.append((12 + 7 * math.cos(a), 15 + 7 * math.sin(a)))
    right = bezier((19, 15), (19, 10.3), (12, 2), (12, 2))
    poly = [(12, 2)] + left + arc + right
    return [(x * scale, y * scale) for (x, y) in poly]


def main():
    os.makedirs(PUBLIC, exist_ok=True)

    ss = 8  # supersampling factor
    canvas = 512 * ss
    img = Image.new('RGBA', (canvas, canvas), BLACK)
    ImageDraw.Draw(img).polygon(droplet(canvas / 24), fill=GOLD)

    for size in (512, 192):
        out = img.resize((size, size), Image.LANCZOS)
        path = os.path.join(PUBLIC, f'icon-{size}.png')
        out.save(path)
        print('wrote', path, out.size)

    # Verify: gold at the droplet center, black at the corners, PNG-legal sizes.
    for size in (512, 192):
        im = Image.open(os.path.join(PUBLIC, f'icon-{size}.png')).convert('RGB')
        c = size // 2
        cx, corner = im.getpixel((c, c)), im.getpixel((2, 2))
        print(f'icon-{size}: center={cx} corner={corner}',
              'OK' if cx == (193, 145, 47) and corner == (0, 0, 0) else 'FAIL')


if __name__ == '__main__':
    main()
