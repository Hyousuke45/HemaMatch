import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-6xl font-extrabold text-red-600">404</p>
      <p className="text-lg font-semibold text-gray-900">Page not found</p>
      <p className="max-w-sm text-sm text-gray-500">
        The page you are looking for does not exist or you followed a broken link.
      </p>
      <Link to="/" className="btn-primary mt-2">
        Back to home
      </Link>
    </div>
  );
}
