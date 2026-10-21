import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './ui';

// Requires a signed-in user. Preserves the attempted route so we can
// return to it after a successful login.
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

// Requires the admin role. [RLS mirror] the database ALSO enforces this
// (admin policies) — hiding routes is UX, not security.
export function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}
