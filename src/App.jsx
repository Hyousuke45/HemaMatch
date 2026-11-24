import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import SidebarLayout from './components/SidebarLayout';
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
import Notifications from './pages/Notifications';
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

// v6 routing: public pages render inside the marketing shell (Layout),
// every authenticated page renders inside the application shell with
// the sidebar + topbar (SidebarLayout). Routes, guards and nested admin
// structure are unchanged — only the shell around them moved.

// Wraps a page so it renders inside SidebarLayout under the same guard.
// SidebarLayout reads the auth context, so it must sit INSIDE the guard.
const app = (element) => <ProtectedRoute><SidebarLayout>{element}</SidebarLayout></ProtectedRoute>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* ---------- Public shell (header + footer) ---------- */}
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            {/* Supabase mode: landing page of the emailed reset link */}
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* ---------- Application shell (sidebar + topbar) ---------- */}
          <Route
            path="/dashboard"
            element={app(
              <Dashboard />
            )}
          />
          <Route
            path="/profile"
            element={app(
              <Profile />
            )}
          />
          <Route
            path="/requests"
            element={app(
              <Requests />
            )}
          />
          <Route
            path="/requests/new"
            element={app(
              <RequestForm />
            )}
          />
          <Route
            path="/requests/:id"
            element={app(
              <RequestDetail />
            )}
          />
          <Route
            path="/requests/:id/edit"
            element={app(
              <RequestForm />
            )}
          />
          {/* v3 — the "donate" side: my listing + the donor directory */}
          <Route
            path="/donate"
            element={app(
              <Donate />
            )}
          />
          <Route
            path="/donors"
            element={app(
              <Donors />
            )}
          />
          <Route
            path="/messages"
            element={app(
              <Messages />
            )}
          />
          <Route
            path="/messages/:conversationId"
            element={app(
              <Messages />
            )}
          />
          <Route
            path="/hospitals"
            element={app(
              <Hospitals />
            )}
          />
          {/* v4 — hospital detail (photo + description + roster) */}
          <Route
            path="/hospitals/:id"
            element={app(
              <HospitalDetail />
            )}
          />
          {/* v4 — business (hospital admin) panel */}
          <Route
            path="/my-hospital"
            element={app(
              <MyHospital />
            )}
          />
          {/* v6.10 — full notifications tab for EVERY role (user inbox;
              business additionally sees their hospital inbox merged),
              linked from the topbar bell and the sidebar */}
          <Route
            path="/notifications"
            element={app(
              <Notifications />
            )}
          />
          {/* v4 — the doctor's witnessed transactions */}
          <Route
            path="/my-assignments"
            element={app(
              <MyAssignments />
            )}
          />

          {/* Administrator only (RLS mirror: database also enforces).
              The sidebar already shows the admin section; AdminLayout
              keeps its sub-navigation tabs for the secondary pages. */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <SidebarLayout>
                  <AdminLayout />
                </SidebarLayout>
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
