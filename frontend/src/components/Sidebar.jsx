/**
 * Sidebar — the left navigation menu.
 *
 * `sidebarConfig` below maps each ROLE to its menu items (section
 * heading, i18n key, route path, icon). To add a page to the menu,
 * add one line to the right role's array — nothing else to change.
 */
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, ListChecks, ClipboardList, Users, UserPlus,
  BarChart2, Building2, Stethoscope, FileText, Monitor, LogOut,
  UserCircle, WalletCards, ClipboardPlus, ShieldCheck, Upload, CalendarDays,
  CalendarCheck, KeyRound, UsersRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useSidebar } from '../context/SidebarContext.jsx';
import Logo from './Logo.jsx';

// Server root (relative avatar paths are resolved against it).
const SERVER_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');
// Avatar path → full URL (Cloudinary URLs pass through unchanged).
const resolveAvatar = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${SERVER_URL}${path}`;
};

const ICONS = {
  Dashboard:        LayoutDashboard,
  Book:             Calendar,
  Queue:            ListChecks,
  History:          ClipboardList,
  Consultation:     FileText,
  Users:            Users,
  'Register Staff': UserPlus,
  'Register Patient': UserPlus,
  'Register Doctor': Stethoscope,
  Reports:          BarChart2,
  Clinics:          Building2,
  Schedule:         CalendarDays,
  'Walk-in':        WalletCards,
  'Queue Display':   Monitor,
  'Patient Reports': ClipboardPlus,
  'Audit Log':       ShieldCheck,
  'Bulk Import':     Upload,
  Appointments:      CalendarCheck,
  'Medical Records': ClipboardList,
  'Clinic Patients': UsersRound,
  Roles:             KeyRound,
  Profile:           UserCircle,
  Logout:            LogOut,
};

// Menu definition per role — the single source of truth for navigation.
const sidebarConfig = {
  patient: [
    { section: 'OVERVIEW',  tKey: 'dashboard',       path: '/patient/dashboard', icon: 'Dashboard' },
    { section: 'SERVICES',  tKey: 'bookAppointment', path: '/patient/book',      icon: 'Book' },
    { section: 'SERVICES',  tKey: 'queueStatus',     path: '/patient/queue',     icon: 'Queue' },
    { section: 'SERVICES',  tKey: 'medicalHistory',  path: '/patient/history',   icon: 'History' },
    { section: 'ACCOUNT',   tKey: 'myProfile',       path: '/patient/profile',   icon: 'Profile' },
  ],
  doctor: [
    { section: 'OVERVIEW',  tKey: 'dashboard',      path: '/doctor/dashboard',     icon: 'Dashboard' },
    { section: 'CLINICAL',  tKey: 'myQueue',        path: '/doctor/queue',         icon: 'Queue' },
    { section: 'CLINICAL',  tKey: 'patientRecords', path: '/doctor/consultation',  icon: 'Consultation' },
    { section: 'CLINICAL',  tKey: 'patientReports', path: '/staff/reports',        icon: 'Patient Reports' },
    { section: 'ACCOUNT',   tKey: 'myProfile',      path: '/doctor/profile',       icon: 'Profile' },
  ],
  staff: [
    { section: 'OVERVIEW',    tKey: 'dashboard',        path: '/staff/dashboard',          icon: 'Dashboard' },
    { section: 'OPERATIONS',  tKey: 'queueManagement',  path: '/staff/queue',              icon: 'Queue' },
    { section: 'OPERATIONS',  tKey: 'walkInBooking',    path: '/staff/walk-in-booking',    icon: 'Walk-in' },
    { section: 'OPERATIONS',  tKey: 'clinicPatients',   path: '/clinic-patients',          icon: 'Clinic Patients' },
    { section: 'OPERATIONS',  tKey: 'registerPatient',  path: '/staff/register-patient',   icon: 'Register Patient' },
    { section: 'OPERATIONS',  tKey: 'registerDoctor',   path: '/staff/register-doctor',    icon: 'Register Doctor' },
    { section: 'DISPLAY',     tKey: 'queueDisplay',     path: '/queue/display',            icon: 'Queue Display' },
    { section: 'DISPLAY',     tKey: 'patientReports',   path: '/staff/reports',            icon: 'Patient Reports' },
    { section: 'ACCOUNT',     tKey: 'myProfile',        path: '/staff/profile',            icon: 'Profile' },
  ],
  admin: [
    { section: 'OVERVIEW',    tKey: 'dashboard',          path: '/admin/dashboard',          icon: 'Dashboard' },
    { section: 'MANAGEMENT',  tKey: 'clinicManagement',   path: '/admin/clinics',            icon: 'Clinics' },
    { section: 'MANAGEMENT',  tKey: 'clinicPatients',     path: '/clinic-patients',          icon: 'Clinic Patients' },
    { section: 'MANAGEMENT',  tKey: 'userManagement',     path: '/admin/users',              icon: 'Users' },
    { section: 'MANAGEMENT',  tKey: 'rolePermissions',    path: '/admin/roles',              icon: 'Roles' },
    { section: 'MANAGEMENT',  tKey: 'appointments',       path: '/admin/appointments',       icon: 'Appointments' },
    { section: 'MANAGEMENT',  tKey: 'medicalRecords',     path: '/admin/records',            icon: 'Medical Records' },
    { section: 'REPORTS',     tKey: 'reports',            path: '/admin/reports',            icon: 'Reports' },
    { section: 'REPORTS',     tKey: 'queueDisplay',       path: '/queue/display',            icon: 'Queue Display' },
    { section: 'REPORTS',     tKey: 'auditLog',           path: '/admin/audit-logs',         icon: 'Audit Log' },
    { section: 'MANAGEMENT',  tKey: 'bulkImport',         path: '/admin/bulk-import',        icon: 'Bulk Import' },
    { section: 'ACCOUNT',     tKey: 'myProfile',          path: '/admin/profile',            icon: 'Profile' },
  ],
};

// One menu link with icon + active highlight.
const NavItem = ({ icon: Icon, label, to, onClick, collapsed }) => {
  const base = `flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 w-full ${collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5'}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={collapsed ? label : undefined}
        className={`${base} text-blue-300 hover:bg-white/10 hover:text-white`}>
        <Icon size={17} className="flex-shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    );
  }

  return (
    <NavLink to={to} title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `${base} ${isActive
          ? `bg-white/15 text-white ${collapsed ? '' : 'border-l-[3px] border-amber-400 pl-[9px]'}`
          : `text-blue-300 hover:bg-white/10 hover:text-white ${collapsed ? '' : 'border-l-[3px] border-transparent'}`
        }`
      }
    >
      <Icon size={17} className="flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
};

// Component (see header).
const Sidebar = () => {
  const { role, logout, user } = useAuth();
  const { collapsed } = useSidebar();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const links = sidebarConfig[role] || [];

  // Log out and go to the login page.
  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  // Group links by section
  const sections = links.reduce((acc, link) => {
    if (!acc[link.section]) acc[link.section] = [];
    acc[link.section].push(link);
    return acc;
  }, {});

  const initial = user?.name?.[0]?.toUpperCase() || '?';

  return (
    <aside className={`bg-blue-900 fixed left-0 top-0 h-screen flex flex-col z-50 transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* Brand */}
      <div className="h-16 flex items-center px-4 border-b border-white/10 flex-shrink-0 overflow-hidden">
        <div className="w-9 h-9 rounded-lg bg-white/95 shadow flex items-center justify-center flex-shrink-0">
          <Logo size={24} />
        </div>
        {!collapsed && <span className="text-white font-bold text-lg tracking-tight ml-3 whitespace-nowrap">MediSync</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-thin">
        {Object.entries(sections).map(([sectionName, sectionLinks]) => (
          <div key={sectionName}>
            {!collapsed && (
              <div className="text-blue-400 text-[10px] font-bold uppercase tracking-widest px-3 mb-1.5">
                {sectionName}
              </div>
            )}
            <div className="space-y-0.5">
              {sectionLinks.map(({ tKey, path, icon }) => {
                const Icon = ICONS[icon] || LayoutDashboard;
                return <NavItem key={path} to={path} icon={Icon} label={t(`sidebar.${tKey}`)} collapsed={collapsed} />;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: user info + logout */}
      <div className="border-t border-white/10 p-2 flex-shrink-0">
        <button type="button" onClick={handleLogout}
          title="Logout"
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-blue-300 hover:bg-white/10 hover:text-white transition-all mb-2">
          <LogOut size={17} className="flex-shrink-0" />
          {!collapsed && <span>{t('sidebar.logout')}</span>}
        </button>

        <div className={`flex items-center gap-2.5 px-2 py-1.5 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
            {user?.avatar
              ? <img src={resolveAvatar(user.avatar)} alt={user?.name} className="w-8 h-8 object-cover" />
              : initial
            }
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-white text-xs font-semibold truncate">{user?.name || 'User'}</div>
              <div className="text-blue-400 text-[10px] capitalize truncate">{role}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
