/**
 * Login.jsx — the sign-in page (the only public page besides the queue
 * displays). Validates the form (required + email shape), calls
 * AuthContext.login, and redirects each role to its own dashboard.
 * Includes the English/Sinhala language toggle and show/hide password.
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { isFilled, isValidEmail } from '../../utils/validators';
import Logo from '../../components/Logo.jsx';
import heroImg from '../../assets/clinic-hero.jpg';
import Toast from '../../components/Toast.jsx';

const dashboardByRole = {
  patient: '/patient/dashboard',
  doctor: '/doctor/dashboard',
  staff: '/staff/dashboard',
  admin: '/admin/dashboard',
};

// Page component.
const Login = () => {
  const { t, i18n } = useTranslation();
  const { login, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated && role) {
      navigate(dashboardByRole[role] || '/', { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  // Validate the form, sign in, and go to the role's dashboard.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    // QA standard: both fields required, and the email must be a real
    // email shape before we even call the API (see utils/validators.js).
    if (!isFilled(form.email) || !isFilled(form.password)) {
      setError(t('validation.requiredAll'));
      return;
    }
    if (!isValidEmail(form.email)) {
      setError(t('validation.invalidEmail'));
      return;
    }
    try {
      setLoading(true);
      const data = await login(form);
      const destination = location.state?.from?.pathname || dashboardByRole[data.role] || '/';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  // Switch English ↔ Sinhala (remembered in localStorage).
  const toggleLang = () => {
    const next = i18n.language === 'en' ? 'si' : 'en';
    i18n.changeLanguage(next);
    localStorage.setItem('ms_lang', next);
  };

  const features = [
    { icon: '🏥', text: t('login.feature1') },
    { icon: '📅', text: t('login.feature2') },
    { icon: '📋', text: t('login.feature3') },
  ];

  return (
    <div className="min-h-screen flex login-page">
      {/* Left panel — clinic photo with overlay */}
      <div className="hidden lg:flex flex-col justify-between w-5/12 p-12 text-white relative overflow-hidden">
        <img src={heroImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-slate-950/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/50 via-transparent to-transparent" />

        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/95 shadow-lg flex items-center justify-center">
            <Logo size={28} />
          </div>
          <span className="text-xl font-bold tracking-wide drop-shadow">MediSync</span>
        </div>

        <div className="relative">
          <div className="inline-block bg-amber-400 text-blue-900 text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-widest shadow">
            Smart OPD System
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4 drop-shadow-lg">{t('login.tagline')}</h1>
          <p className="text-blue-100/90 text-base leading-relaxed mb-10 drop-shadow">{t('login.taglineDesc')}</p>
          <div className="space-y-4">
            {features.map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-base flex-shrink-0">
                  {icon}
                </div>
                <span className="text-blue-50 text-sm font-medium drop-shadow">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-blue-200/70 text-xs">© 2025 MediSync. All rights reserved.</p>
      </div>

      {/* Right panel — dark sign-in area */}
      <div className="flex-1 flex items-center justify-center bg-slate-950 p-8 relative">
        {/* Language toggle */}
        <button
          type="button"
          onClick={toggleLang}
          className="absolute top-5 right-5 flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
        >
          {i18n.language === 'en' ? 'LK සිංහල' : 'EN English'}
        </button>

        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-8">
            <div className="w-11 h-11 rounded-xl bg-white shadow-lg flex items-center justify-center">
              <Logo size={28} />
            </div>
            <span className="text-2xl font-bold text-white">MediSync</span>
          </div>

          {/* Login card — email + password (with show/hide toggle) */}
          <div className="bg-slate-900 rounded-3xl shadow-2xl shadow-black/40 border border-slate-800 p-8 md:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white">{t('login.welcome')}</h2>
              <p className="text-slate-400 text-sm mt-1">{t('login.subtitle')}</p>
            </div>

            <Toast error={error} onClearError={() => setError('')} />

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-200 mb-2">
                  {t('login.emailLabel')}
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder={t('login.emailPlaceholder')}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="login-input w-full h-11 border border-slate-700 rounded-xl px-4 text-sm bg-slate-800/80 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-slate-500 transition"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-200 mb-2">
                  {t('login.passwordLabel')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('login.passwordPlaceholder')}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    className="login-input w-full h-11 border border-slate-700 rounded-xl px-4 pr-11 text-sm bg-slate-800/80 text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-slate-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-400 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('login.signingIn')}
                  </>
                ) : t('login.signIn')}
              </button>
            </form>

            <p className="text-center text-slate-500 text-xs mt-6">{t('login.noAccount')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
