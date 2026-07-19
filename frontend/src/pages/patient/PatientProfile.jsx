/**
 * PatientProfile.jsx — the patient's own profile page.
 * View mode shows account + medical details (incl. BMI); edit mode lets
 * the patient update contact/medical info, emergency contact, and
 * optionally change the password. Saves via PUT /auth/profile.
 */
import { useEffect, useState } from 'react';
import { User, Mail, Phone, CreditCard, Calendar, MapPin, Droplets, Heart, Save, Key, Edit3, X, Weight, Ruler, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { authService } from '../../api';
import AvatarUpload from '../../components/AvatarUpload.jsx';
import { computeBmi } from '../../utils/health.js';
import { setStoredUser } from '../../utils/authStorage';

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['not-specified', 'male', 'female', 'other'];

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
const PatientProfile = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [patProfile, setPatProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', password: '', confirmPassword: '',
    dateOfBirth: '', gender: 'not-specified', age: '', weight: '', height: '', address: '', bloodGroup: '',
    ecName: '', ecPhone: '', ecRelationship: '',
  });
  const [msg, setMsg] = useState({ text: '', error: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authService.getProfile().then((data) => {
      setProfile(data.user); setPatProfile(data.profile);
      const p = data.profile || {};
      setForm((f) => ({
        ...f, name: data.user.name || '', phone: data.user.phone || '',
        dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '',
        gender: p.gender || 'not-specified', age: p.age ?? '',
        weight: p.weight ?? '', height: p.height ?? '', address: p.address || '',
        bloodGroup: p.bloodGroup || '', ecName: p.emergencyContact?.name || '',
        ecPhone: p.emergencyContact?.phone || '', ecRelationship: p.emergencyContact?.relationship || '',
      }));
    });
  }, []);

  // Update one form field.
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Validate + save profile changes (and optional new password).
  const handleSave = async () => {
    if (form.password && form.password !== form.confirmPassword) {
      setMsg({ text: t('profile.updateFailed'), error: true }); return;
    }
    setSaving(true); setMsg({ text: '', error: false });
    try {
      const body = {
        name: form.name, phone: form.phone, dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender, age: form.age !== '' ? Number(form.age) : undefined,
        weight: form.weight !== '' ? Number(form.weight) : undefined,
        height: form.height !== '' ? Number(form.height) : undefined,
        address: form.address, bloodGroup: form.bloodGroup,
        emergencyContact: { name: form.ecName, phone: form.ecPhone, relationship: form.ecRelationship },
      };
      if (form.password) body.password = form.password;
      const data = await authService.updateProfile(body);
      setProfile(data.user); setPatProfile(data.profile);
      setStoredUser(data.user);
      setMsg({ text: t('profile.profileUpdated'), error: false });
      setEditing(false);
      setForm((f) => ({ ...f, password: '', confirmPassword: '' }));
    } catch (err) {
      setMsg({ text: err.response?.data?.message || t('profile.updateFailed'), error: true });
    } finally { setSaving(false); }
  };

  const src = profile || user;
  const p = patProfile || {};

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">{t('profile.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('profile.editProfile')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 items-start">
          {/* Avatar card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center gap-3">
            <AvatarUpload name={src?.name} avatarPath={src?.avatar} accentColor="#1E40AF"
              onUploaded={(updatedUser) => setProfile(updatedUser)} />
            <div className="text-center">
              <div className="text-base font-bold text-gray-900">{src?.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{src?.email}</div>
            </div>
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full px-3 py-1">Patient</span>
            {p.bloodGroup && (
              <div className="flex items-center gap-1.5 text-sm font-bold text-red-500">
                <Droplets size={13} /> {p.bloodGroup}
              </div>
            )}
            {p.age && <div className="text-xs text-gray-500">{t('profile.age')}: {p.age}</div>}
            <div className="text-[11px] text-gray-400">
              {src?.createdAt ? new Date(src.createdAt).toLocaleDateString() : '—'}
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-base font-bold text-blue-900">{t('profile.name')}</span>
                {!editing ? (
                  <button type="button" onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors">
                    <Edit3 size={12} /> {t('profile.editProfile')}
                  </button>
                ) : (
                  <button type="button" onClick={() => { setEditing(false); setMsg({ text: '', error: false }); }}
                    className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors">
                    <X size={12} /> {t('profile.cancel')}
                  </button>
                )}
              </div>

              {/* View mode: read-only rows. Edit mode: the form below. */}
              {!editing ? (
                <>
                  <Field icon={User} label={t('profile.name')} value={src?.name} />
                  <Field icon={Mail} label={t('profile.email')} value={src?.email} />
                  <Field icon={Phone} label={t('profile.phone')} value={src?.phone} />
                  <Field icon={CreditCard} label={t('profile.nic')} value={src?.NIC} />
                  <Field icon={Calendar} label={t('profile.dob')} value={p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : null} />
                  <Field icon={User} label={t('profile.gender')} value={p.gender} />
                  <Field icon={Droplets} label={t('profile.bloodGroup')} value={p.bloodGroup} />
                  <Field icon={Weight} label={t('profile.weight')} value={p.weight ? `${p.weight} kg` : null} />
                  <Field icon={Ruler} label={t('profile.height')} value={p.height ? `${p.height} cm` : null} />
                  {(() => {
                    const bmi = computeBmi(p.weight, p.height);
                    return <Field icon={Activity} label={t('profile.bmi')} value={bmi ? `${bmi.value} (${bmi.label})` : null} />;
                  })()}
                  <Field icon={MapPin} label={t('profile.address')} value={p.address} />
                </>
              ) : (
                <>
                  {msg.text && (
                    <div className={`rounded-xl p-3 text-sm mb-4 ${msg.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg.text}</div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className={labelClass}>{t('profile.name')}</label>
                      <input className={inputClass} value={form.name} onChange={set('name')} />
                    </div>
                    <div>
                      <label className={labelClass}>{t('profile.phone')}</label>
                      <input className={inputClass} value={form.phone} onChange={set('phone')} />
                    </div>
                    <div>
                      <label className={labelClass}>{t('profile.dob')}</label>
                      <input type="date" className={inputClass} value={form.dateOfBirth} onChange={set('dateOfBirth')} />
                    </div>
                    <div>
                      <label className={labelClass}>{t('profile.age')}</label>
                      <input type="number" className={inputClass} value={form.age} onChange={set('age')} />
                    </div>
                    <div>
                      <label className={labelClass}>{t('profile.weight')}</label>
                      <input type="number" min="0" step="0.1" className={inputClass} value={form.weight} onChange={set('weight')} />
                    </div>
                    <div>
                      <label className={labelClass}>{t('profile.height')}</label>
                      <input type="number" min="0" step="0.1" className={inputClass} value={form.height} onChange={set('height')} />
                    </div>
                    <div>
                      <label className={labelClass}>{t('profile.gender')}</label>
                      <select className={inputClass} value={form.gender} onChange={set('gender')}>
                        {GENDERS.map((o) => <option key={o} value={o}>{t(`profile.${o}`) || o || 'Select…'}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>{t('profile.bloodGroup')}</label>
                      <select className={inputClass} value={form.bloodGroup} onChange={set('bloodGroup')}>
                        {BLOOD_GROUPS.map((o) => <option key={o} value={o}>{o || 'Select…'}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className={labelClass}>{t('profile.address')}</label>
                    <input className={inputClass} value={form.address} onChange={set('address')} />
                  </div>

                  {/* Emergency contact sub-form */}
                  <div className="border-t border-gray-100 pt-4 mt-2 mb-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-3">
                      <Heart size={12} /> {t('profile.emergencyContact')}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={labelClass}>{t('profile.emergencyName')}</label>
                        <input className={inputClass} value={form.ecName} onChange={set('ecName')} />
                      </div>
                      <div>
                        <label className={labelClass}>{t('profile.emergencyPhone')}</label>
                        <input className={inputClass} value={form.ecPhone} onChange={set('ecPhone')} />
                      </div>
                      <div>
                        <label className={labelClass}>{t('profile.relationship')}</label>
                        <input className={inputClass} value={form.ecRelationship} onChange={set('ecRelationship')} />
                      </div>
                    </div>
                  </div>

                  {/* Optional password change (blank = keep current) */}
                  <div className="border-t border-gray-100 pt-4 mt-2 mb-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-3">
                      <Key size={12} /> Change Password
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>New Password</label>
                        <input type="password" className={inputClass} value={form.password} onChange={set('password')} placeholder="Leave blank to keep current" />
                      </div>
                      <div>
                        <label className={labelClass}>Confirm Password</label>
                        <input type="password" className={inputClass} value={form.confirmPassword} onChange={set('confirmPassword')} />
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-60">
                    <Save size={14} /> {saving ? t('common.loading') : t('profile.saveChanges')}
                  </button>
                </>
              )}
            </div>

            {/* Emergency contact summary card (view mode only) */}
            {!editing && (p.emergencyContact?.name || p.emergencyContact?.phone) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="text-base font-bold text-blue-900 mb-3">{t('profile.emergencyContact')}</div>
                <Field icon={Heart} label={t('profile.emergencyName')} value={p.emergencyContact?.name} />
                <Field icon={Phone} label={t('profile.emergencyPhone')} value={p.emergencyContact?.phone} />
                <Field icon={User} label={t('profile.relationship')} value={p.emergencyContact?.relationship} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientProfile;
