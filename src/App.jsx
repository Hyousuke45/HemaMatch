import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Requests from './pages/Requests';
import RequestForm from './pages/RequestForm';
import RequestDetail from './pages/RequestDetail';
import Donate from './pages/Donate';
import Donors from './pages/Donors';
import Messages from './pages/Messages';
import Hospitals from './pages/Hospitals';
import HospitalDetail from './pages/HospitalDetail';
import MyHospital from './pages/MyHospital';
import MyAssignments from './pages/MyAssignments';
import NotFound from './pages/NotFound';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRequests from './pages/admin/AdminRequests';
import AdminRecords from './pages/admin/AdminRecords';
import AdminUsers from './pages/admin/AdminUsers';
import AdminHospitals from './pages/admin/AdminHospitals';
import AdminLogs from './pages/admin/AdminLogs';

// Scrolls to top on route change (standard SPA behavior)
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route element={<Layout />}>
            {/* Public */}
            <Route index element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            {/* Supabase mode: landing page of the emailed reset link */}
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Authenticated */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests"
              element={
                <ProtectedRoute>
                  <Requests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/new"
              element={
                <ProtectedRoute>
                  <RequestForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/:id"
              element={
                <ProtectedRoute>
                  <RequestDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/requests/:id/edit"
              element={
                <ProtectedRoute>
                  <RequestForm />
                </ProtectedRoute>
              }
            />
            {/* v3 — the "donate" side: my listing + the donor directory */}
            <Route
              path="/donate"
              element={
                <ProtectedRoute>
                  <Donate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/donors"
              element={
                <ProtectedRoute>
                  <Donors />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages/:conversationId"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hospitals"
              element={
                <ProtectedRoute>
                  <Hospitals />
                </ProtectedRoute>
              }
            />
            {/* v4 — hospital detail (photo + description + roster) */}
            <Route
              path="/hospitals/:id"
              element={
                <ProtectedRoute>
                  <HospitalDetail />
                </ProtectedRoute>
              }
            />
            {/* v4 — business (hospital admin) panel */}
            <Route
              path="/my-hospital"
              element={
                <ProtectedRoute>
                  <MyHospital />
                </ProtectedRoute>
              }
            />
            {/* v4 — the doctor's witnessed transactions */}
            <Route
              path="/my-assignments"
              element={
                <ProtectedRoute>
                  <MyAssignments />
                </ProtectedRoute>
              }
            />

            {/* Administrator only (RLS mirror: database also enforces) */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="records" element={<AdminRecords />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="hospitals" element={<AdminHospitals />} />
              <Route path="logs" element={<AdminLogs />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
