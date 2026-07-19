/**
 * App.jsx — the router for the whole frontend.
 *
 * Every page is registered here, grouped by role (patient / doctor /
 * staff / admin) and wrapped in <ProtectedRoute allowedRoles={…}> so a
 * user can only open pages meant for their role. Shared layout (Navbar
 * + Sidebar) is applied to all pages except the login and the public
 * queue display screens.
 */
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/auth/Login.jsx';
import PatientDashboard from './pages/patient/PatientDashboard.jsx';
import BookAppointment from './pages/patient/BookAppointment.jsx';
import QueueStatus from './pages/patient/QueueStatus.jsx';
import MedicalHistory from './pages/patient/MedicalHistory.jsx';
import DoctorDashboard from './pages/doctor/DoctorDashboard.jsx';
import PatientQueue from './pages/doctor/PatientQueue.jsx';
import ConsultationRecord from './pages/doctor/ConsultationRecord.jsx';
import StaffDashboard from './pages/staff/StaffDashboard.jsx';
import QueueManagement from './pages/staff/QueueManagement.jsx';
import RegisterPatient from './pages/staff/RegisterPatient.jsx';
import RegisterDoctor from './pages/staff/RegisterDoctor.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import UserManagement from './pages/admin/UserManagement.jsx';
import Reports from './pages/admin/Reports.jsx';
import ClinicManagement from './pages/admin/ClinicManagement.jsx';
import QueueDisplayScreen from './pages/queue/QueueDisplayScreen.jsx';
import PublicQueueDisplay from './pages/queue/PublicQueueDisplay.jsx';
import WalkInBooking from './pages/staff/WalkInBooking.jsx';
import ClinicPatients from './pages/staff/ClinicPatients.jsx';
import AdminProfile from './pages/admin/AdminProfile.jsx';
import StaffProfile from './pages/staff/StaffProfile.jsx';
import DoctorProfile from './pages/doctor/DoctorProfile.jsx';
import PatientProfile from './pages/patient/PatientProfile.jsx';
import PatientReports from './pages/staff/PatientReports.jsx';
import AuditLog from './pages/admin/AuditLog.jsx';
import BulkImport from './pages/admin/BulkImport.jsx';
import AppointmentManagement from './pages/admin/AppointmentManagement.jsx';
import MedicalRecords from './pages/admin/MedicalRecords.jsx';
import RolePermissions from './pages/admin/RolePermissions.jsx';

const dashboardByRole = {
  patient: '/patient/dashboard',
  doctor: '/doctor/dashboard',
  staff: '/staff/dashboard',
  admin: '/admin/dashboard',
};

// Shared shell: navbar + sidebar around every protected page.
const AppLayout = () => (
  <>
    <Navbar />
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  </>
);

// '/' → the logged-in role's dashboard (or login).
const RoleRedirect = () => {
  const { role, isAuthenticated, loading } = useAuth();

  if (loading) return <div className="app-loader">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={dashboardByRole[role] || '/login'} replace />;
};

// All routes, grouped by role.
const App = () => (
  <BrowserRouter>
    <Routes>
      {/* Public pages — no login needed */}
      <Route path="/" element={<RoleRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/display" element={<PublicQueueDisplay />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Patient pages */}
        <Route
          path="/patient/dashboard"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <PatientDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/book"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <BookAppointment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/queue"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <QueueStatus />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/history"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <MedicalHistory />
            </ProtectedRoute>
          }
        />

        {/* Doctor pages */}
        <Route
          path="/doctor/dashboard"
          element={
            <ProtectedRoute allowedRoles={['doctor']}>
              <DoctorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/queue"
          element={
            <ProtectedRoute allowedRoles={['doctor']}>
              <PatientQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/consultation"
          element={
            <ProtectedRoute allowedRoles={['doctor']}>
              <ConsultationRecord />
            </ProtectedRoute>
          }
        />

        {/* Staff pages */}
        <Route
          path="/staff/dashboard"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <StaffDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/queue"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <QueueManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/register-patient"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <RegisterPatient />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/register-doctor"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <RegisterDoctor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/walk-in-booking"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <WalkInBooking />
            </ProtectedRoute>
          }
        />
        <Route path="/staff/walk-in-token" element={<Navigate to="/staff/walk-in-booking" replace />} />
        <Route
          path="/clinic-patients"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <ClinicPatients />
            </ProtectedRoute>
          }
        />

        {/* Admin pages */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/clinics"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ClinicManagement />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/schedule" element={<Navigate to="/admin/clinics" replace />} />
        <Route
          path="/admin/profile"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/reports"
          element={
            <ProtectedRoute allowedRoles={['staff', 'admin', 'doctor']}>
              <PatientReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/profile"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <StaffProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/profile"
          element={
            <ProtectedRoute allowedRoles={['doctor']}>
              <DoctorProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/profile"
          element={
            <ProtectedRoute allowedRoles={['patient']}>
              <PatientProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/queue/display"
          element={
            <ProtectedRoute allowedRoles={['doctor', 'staff', 'admin']}>
              <QueueDisplayScreen />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AuditLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/bulk-import"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <BulkImport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/appointments"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppointmentManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/records"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MedicalRecords />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <RolePermissions />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Unknown URL → back to the role's dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
