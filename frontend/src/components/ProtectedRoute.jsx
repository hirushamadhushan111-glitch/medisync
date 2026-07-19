/**
 * ProtectedRoute — route guard used in App.jsx.
 *
 * Not logged in            → redirect to /login (remembering where they were).
 * Logged in but wrong role → redirect to that role's own dashboard.
 * Otherwise                → render the page.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const dashboardByRole = {
  patient: '/patient/dashboard',
  doctor: '/doctor/dashboard',
  staff: '/staff/dashboard',
  admin: '/admin/dashboard',
};

// Wraps a page: checks login + role before rendering (see header).
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-loader">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    return <Navigate to={dashboardByRole[role] || '/login'} replace />;
  }

  return children;
};

export default ProtectedRoute;
