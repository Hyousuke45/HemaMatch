// ============================================================
// HEMAMATCH — PROFILE PHOTO UPLOADS (Cloudinary, unsigned)
// ------------------------------------------------------------
// Profile pictures are stored as plain https URLs on the profile
// row (profiles.avatar_url). The recommended upload path uses a
// Cloudinary UNSIGNED upload preset, so there is no API secret in
// the browser — exactly like the Supabase anon key, an unsigned
// preset is safe to expose client-side (uploads only, your
// Cloudinary account settings control what it can do).
//
// Setup (2 minutes, free tier is plenty for an academic project):
//   1. Create a free account at https://cloudinary.com
//   2. Settings -> Upload -> "Add upload preset"
//   3. Set Signing Mode: UNSIGNED
//      (optionally restrict allowed formats to images and enable
//       foldering, e.g. folder: "hemamatch/avatars")
//   4. Copy the preset name + your Cloud name (Dashboard home)
//   5. Put both in .env:
//        VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
//        VITE_CLOUDINARY_UPLOAD_PRESET=your-preset-name
//
// NOT configured? The Profile page automatically falls back to
// "paste an image URL" mode, so the feature still works for the
// demo (the seeded demo accounts already have generated photos).
// ============================================================

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const isCloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

// Client-side guards (the unsigned preset/server settings are the
// authoritative limits — these just fail fast with a clear message).
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function validateImageFile(file) {
  if (!file) return 'Choose a photo first.';
  if (!ACCEPTED_TYPES.includes(file.type))
    return 'Unsupported file type. Please choose a JPG, PNG, WEBP or GIF image.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Photo is too large. Maximum size is 5 MB.';
  return null; // no error
}

// Uploads the file and resolves with the secure https URL to store
// on the profile. The upload itself never touches HemaMatch servers.
export async function uploadAvatar(file) {
  const fileError = validateImageFile(file);
  if (fileError) throw new Error(fileError);
  if (!isCloudinaryConfigured)
    throw new Error(
      'Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to .env (see README), or paste an image URL below instead.'
    );

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.secure_url) {
    throw new Error(data?.error?.message || 'Upload failed. Please try again.');
  }
  return data.secure_url;
}
