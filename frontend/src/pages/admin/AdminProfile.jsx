/**
 * AdminProfile.jsx — the admin's own profile page.
 * View/edit name and phone, and optionally change the password.
 * Saves via PUT /auth/profile.
 */
import { useEffect, useState } from 'react';
import { User, Mail, Phone, CreditCard, Shield, Save, Key, Edit3, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { authService } from '../../api';
import AvatarUpload from '../../components/AvatarUpload.jsx';
import { setStoredUser } from '../../utils/authStorage';

// Read-only labelled row with an icon (view mode).
const Field = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
      <Icon size={14} className="text-blue-700" />
    </div>
    <div>
      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</div>
      <div className="text-sm text-gray-900 font-medium mt-0.5">{value || '—'}</div>
    </div>
  </div>
);

const inputClass = 'w-full h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5';

// Page component.
const AdminProfile = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', password: '', confirmPassword: '' });
  const [msg, setMsg] = useState({ text: '', error: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authService.getProfile().then((data) => {
      setProfile(data.user);
      setForm((f) => ({ ...f, name: data.user.name || '', phone: data.user.phone || '' }));
    });
  }, []);

  // Update one form field.
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Validate + save profile changes (and optional new password).
  const handleSave = async () => {
    if (form.password && form.password !== form.confirmPassword) {
      setMsg({ text: t('adminProfile.passwordMismatch'), error: true }); return;
    }
    setSaving(true); setMsg({ text: '', error: false });
    try {
      const body = { name: form.name, phone: form.phone };
      if (form.password) body.password = form.password;
      const data = await authService.updateProfile(body);
      setProfile(data.user);
      setStoredUser(data.user);
      setMsg({ text: t('adminProfile.saved'), error: false });
      setEditing(false);
      setForm((f) => ({ ...f, password: '', confirmPassword: '' }));
    } catch (err) {
      setMsg({ text: err.response?.data?.message || t('adminProfile.updateFailed'), error: true });
    } finally { setSaving(false); }
  };

  const src = profile || user;

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">{t('adminProfile.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('adminProfile.subtitle')}</p>
        </div>

        {/* Left: avatar card. Right: details (view mode ↔ edit form). */}
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center gap-3">
            <AvatarUpload name={src?.name} avatarPath={src?.avatar} accentColor="#1E3A8A"
              onUploaded={(updatedUser) => setProfile(updatedUser)} />
            <div className="text-center">
              <div className="text-base font-bold text-gray-900">{src?.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{src?.email}</div>
            </div>
            <span className="bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full px-3 py-1">{t('adminProfile.administrator')}</span>
            <div className="text-[11px] text-gray-400">
              {t('adminProfile.memberSince')} {src?.createdAt ? new Date(src.createdAt).toLocaleDateString() : '—'}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-base font-bold text-blue-900">{t('adminProfile.accountDetails')}</span>
              {!editing ? (
                <button type="button" onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors">
                  <Edit3 size={12} /> {t('adminProfile.edit')}
                </button>
              ) : (
                <button type="button" onClick={() => { setEditing(false); setMsg({ text: '', error: false }); }}
                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors">
                  <X size={12} /> {t('adminProfile.cancel')}
                </button>
              )}
            </div>

            {!editing ? (
              <>
                <Field icon={User}       label={t('adminProfile.name')}  value={src?.name} />
                <Field icon={Mail}       label={t('adminProfile.email')} value={src?.email} />
                <Field icon={Phone}      label={t('adminProfile.phone')} value={src?.phone} />
                <Field icon={CreditCard} label={t('adminProfile.nic')}   value={src?.NIC} />
                <Field icon={Shield}     label={t('adminProfile.role')}  value={t('adminProfile.administrator')} />
              </>
            ) : (
              <>
                {msg.text && (
                  <div className={`rounded-xl p-3 text-sm mb-4 ${msg.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg.text}</div>
                )}
                <div className="mb-3">
                  <label className={labelClass}>{t('adminProfile.name')}</label>
                  <input className={inputClass} value={form.name} onChange={set('name')} />
                </div>
                <div className="mb-3">
                  <label className={labelClass}>{t('adminProfile.phone')}</label>
                  <input className={inputClass} value={form.phone} onChange={set('phone')} />
                </div>
                {/* Optional password change (blank = keep current) */}
                <div className="border-t border-gray-100 pt-4 mt-2 mb-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-3">
                    <Key size={12} /> {t('adminProfile.changePassword')}
                  </div>
                  <div className="mb-3">
                    <label className={labelClass}>{t('adminProfile.newPassword')}</label>
                    <input className={inputClass} type="password" value={form.password} onChange={set('password')} placeholder={t('adminProfile.passwordHint')} />
                  </div>
                  <div className="mb-3">
                    <label className={labelClass}>{t('adminProfile.confirmPassword')}</label>
                    <input className={inputClass} type="password" value={form.confirmPassword} onChange={set('confirmPassword')} />
                  </div>
                </div>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-60">
                  <Save size={14} /> {saving ? t('adminProfile.saving') : t('adminProfile.save')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
