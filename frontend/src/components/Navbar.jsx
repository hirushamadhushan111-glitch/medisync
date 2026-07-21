// Navbar.jsx — the top bar on every logged-in page: sidebar toggle,
// live patient search, clinic selector, language/theme switches,
// notification bell and the profile dropdown with logout.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, MapPin, ChevronDown, LogOut, Sun, Moon, X, User, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useSidebar } from '../context/SidebarContext.jsx';
import { useClinic } from '../context/ClinicContext.jsx';
import NotificationBell from './NotificationBell.jsx';
import patientService from '../api/services/PatientApiService.js';
import { clinicDisplayName, clinicTypeLabel } from '../utils/clinicTypes.js';

// Badge colour + label shown next to the avatar for each role.
const rolePills = {
  admin:   { label: 'Admin',   classes: 'bg-amber-400 text-blue-900' },
  doctor:  { label: 'Doctor',  classes: 'bg-green-100 text-green-800' },
  staff:   { label: 'Staff',   classes: 'bg-blue-100 text-blue-800' },
  patient: { label: 'Patient', classes: 'bg-blue-50 text-blue-700' },
};

// Component — top bar: search, clinic selector, theme/lang, profile.
const Navbar = () => {
  const { t, i18n } = useTranslation();
  const { user, logout, role } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { toggleSidebar } = useSidebar();
  const { clinics, activeClinic, setActiveClinic } = useClinic();
  const navigate = useNavigate();

  // Switch English ↔ Sinhala (remembered in localStorage).
  const toggleLang = () => {
    const next = i18n.language === 'en' ? 'si' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('ms_lang', next);
  };

  const [search, setSearch]           = useState('');
  const [results, setResults]         = useState([]);
  const [searching, setSearching]     = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showClinicDD, setShowClinicDD] = useState(false);

  const searchRef  = useRef(null);
  const clinicRef  = useRef(null);
  const debounceRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    // Close any open dropdown when clicking elsewhere.
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
      if (clinicRef.current && !clinicRef.current.contains(e.target)) setShowClinicDD(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced patient search
  const handleSearch = useCallback((val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await patientService.search(val.trim());
        setResults(res.slice(0, 6));
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  // Clear the search box and its results.
  const clearSearch = () => { setSearch(''); setResults([]); setShowResults(false); };

  // Open a searched patient in the right page for the current role:
  // doctor → consultation record (preselected), staff/admin → patient reports
  const openPatient = (p) => {
    clearSearch();
    if (role === 'doctor') navigate(`/doctor/consultation?patientId=${p._id}`);
    else navigate('/staff/reports', { state: { patient: p } });
  };

  // Log out and return to the login page.
  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const pill = rolePills[role] || { label: role || 'User', classes: 'bg-gray-100 text-gray-700' };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700 fixed top-0 left-56 right-0 h-16 z-40 flex items-center px-3 sm:px-5 gap-2 sm:gap-3 transition-all duration-300 sidebar-nav">
      {/* LEFT: hamburger + search */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          type="button"
          onClick={toggleSidebar}
          title="Toggle sidebar"
          className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
        >
          <Menu size={20} className="text-gray-500 dark:text-gray-400" />
        </button>

        {/* Patient search — only for admin/staff/doctor */}
        {role !== 'patient' && (
          <div ref={searchRef} className="relative hidden sm:block">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder={t('nav.searchPlaceholder')}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => results.length > 0 && setShowResults(true)}
                className="w-40 lg:w-64 h-9 border border-gray-200 dark:border-gray-600 rounded-xl pl-8 pr-8 text-sm bg-blue-50 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-gray-400 transition-colors"
              />
              {search && (
                <button type="button" onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {showResults && (
              <div className="absolute top-full left-0 mt-1.5 w-72 sm:w-80 max-w-[calc(100vw-4rem)] bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
                {searching ? (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">Searching…</div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">No patients found</div>
                ) : (
                  <>
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {results.length} result{results.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {results.map((p) => (
                      <div
                        key={p._id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0"
                        onClick={() => openPatient(p)}
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                          <User size={14} className="text-blue-600 dark:text-blue-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                            {p.userId?.name || '—'}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 flex gap-2">
                            <span>NIC: {p.NIC}</span>
                            {p.userId?.phone && <span>· {p.userId.phone}</span>}
                          </div>
                        </div>
                        <span className="text-xs text-gray-300 dark:text-gray-600 capitalize">{p.gender || ''}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CENTER: clinic selector */}
      {role !== 'patient' && clinics.length > 0 && (
        <div ref={clinicRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowClinicDD((v) => !v)}
            className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors"
          >
            <MapPin size={14} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />
            <span className="max-w-[80px] sm:max-w-[140px] truncate">{activeClinic ? clinicDisplayName(activeClinic, t) : t('nav.selectClinic')}</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${showClinicDD ? 'rotate-180' : ''}`} />
          </button>

          {showClinicDD && (
            <div className="absolute top-full right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 mt-1.5 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden py-1">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('nav.activeClinics')}</span>
              </div>
              {clinics.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => { setActiveClinic(c); setShowClinicDD(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                    activeClinic?._id === c._id
                      ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeClinic?._id === c._id ? 'bg-blue-500' : 'bg-gray-300'}`} />
                  <div className="min-w-0">
                    <div className="truncate">{clinicDisplayName(c, t)}</div>
                    <div className="text-[10px] text-gray-400 truncate">{clinicTypeLabel(c.departmentType, t)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RIGHT */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap hidden sm:inline-block ${
          isDark ? 'bg-amber-400/15 text-amber-300' : pill.classes
        }`}>
          {pill.label}
        </span>

        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? t('nav.lightMode') : t('nav.darkMode')}
          className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 ${
            isDark ? 'bg-amber-400/20 text-amber-400 hover:bg-amber-400/30' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Language toggle */}
        <button
          type="button"
          onClick={toggleLang}
          title={i18n.language === 'en' ? 'සිංහල' : 'English'}
          className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 bg-blue-50 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-gray-600"
        >
          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 leading-none">
            {i18n.language === 'en' ? 'සිං' : 'EN'}
          </span>
        </button>

        <NotificationBell />

        {user?.name && (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden md:block">{user.name}</span>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-xl px-2.5 sm:px-3 py-1.5 text-sm font-semibold transition-colors"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">{t('nav.logout')}</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
