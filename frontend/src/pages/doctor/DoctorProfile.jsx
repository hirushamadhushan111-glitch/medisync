/**
 * DoctorProfile.jsx — the doctor's own profile page.
 *
 * View/edit personal info, department + specialization, the weekly
 * consultation schedule (add/remove day slots), optional password
 * change, and an availability toggle that broadcasts live to staff
 * queue screens.
 */
import { useEffect, useState } from 'react';
import { User, Mail, Phone, CreditCard, Stethoscope, Building2, Save, Key, Edit3, X, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext.jsx';
import { authService, doctorService } from '../../api';
import AvatarUpload from '../../components/AvatarUpload.jsx';
import { DEPARTMENTS, departmentLabel, specializationLabel } from '../../utils/departments';
import { setStoredUser } from '../../utils/authStorage';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Read-only labelled row with an icon (view mode).
const Field = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
    <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
      <Icon size={14} className="text-green-700" />
    </div>
    <div>
      <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</div>
      <div className="text-sm text-gray-900 font-medium mt-0.5">{value || '—'}</div>
    </div>
  </div>
);

const inputClass = 'w-full h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5';
const slotInputClass = 'h-9 border border-gray-200 rounded-xl px-3 text-xs bg-blue-50 outline-none focus:ring-1 focus:ring-blue-500';

// Page component.
const DoctorProfile = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [docProfile, setDocProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', department: '', specialization: '', password: '', confirmPassword: '' });
  const [schedule, setSchedule] = useState([]);
  const [availability, setAvailability] = useState(true);
  const [msg, setMsg] = useState({ text: '', error: false });
  const [saving, setSaving] = useState(false);
  const [togglingAvail, setTogglingAvail] = useState(false);

  useEffect(() => {
    authService.getProfile().then((data) => {
      setProfile(data.user); setDocProfile(data.profile);
      setAvailability(data.profile?.isAvailable ?? true);
      setForm((f) => ({
        ...f, name: data.user.name || '', phone: data.user.phone || '',
        department: data.profile?.department || '', specialization: data.profile?.specialization || '',
      }));
      setSchedule(data.profile?.consultationSchedule || []);
    });
  }, []);

  // Update one form field.
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  // Add a new weekly schedule slot.
  const addSlot = () => setSchedule((s) => [...s, { day: 'Monday', startTime: '08:00', endTime: '17:00' }]);
  // Remove a schedule slot.
  const removeSlot = (i) => setSchedule((s) => s.filter((_, idx) => idx !== i));
  // Change one field of a schedule slot.
  const updateSlot = (i, field, val) => setSchedule((s) => s.map((slot, idx) => idx === i ? { ...slot, [field]: val } : slot));

  // Flip availability (broadcast live to staff screens).
  const toggleAvailability = async () => {
    setTogglingAvail(true);
    try {
      await doctorService.updateAvailability(!availability);
      setAvailability((a) => !a);
    } catch (err) {
      setMsg({ text: err.response?.data?.message || t('doctorProfile.updateFailed'), error: true });
    } finally { setTogglingAvail(false); }
  };

  // Validate + save profile, schedule and optional new password.
  const handleSave = async () => {
    if (form.password && form.password !== form.confirmPassword) {
      setMsg({ text: t('doctorProfile.updateFailed'), error: true }); return;
    }
    setSaving(true); setMsg({ text: '', error: false });
    try {
      const body = { name: form.name, phone: form.phone, department: form.department, specialization: form.specialization, consultationSchedule: schedule };
      if (form.password) body.password = form.password;
      const data = await authService.updateProfile(body);
      setProfile(data.user); setDocProfile(data.profile);
      setStoredUser(data.user);
      setMsg({ text: t('doctorProfile.saved'), error: false });
      setEditing(false);
      setForm((f) => ({ ...f, password: '', confirmPassword: '' }));
    } catch (err) {
      setMsg({ text: err.response?.data?.message || t('doctorProfile.updateFailed'), error: true });
    } finally { setSaving(false); }
  };

  const src = profile || user;

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">{t('doctorProfile.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('doctorProfile.subtitle')}</p>
        </div>

        {/* Two-column layout: left = avatar + availability, right = details */}
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 items-start">
          <div className="flex flex-col gap-4">
            {/* Avatar card with name, email, specialization */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center gap-3">
              <AvatarUpload name={src?.name} avatarPath={src?.avatar} accentColor="#065F46"
                onUploaded={(updatedUser) => setProfile(updatedUser)} />
              <div className="text-center">
                <div className="text-base font-bold text-gray-900">{src?.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{src?.email}</div>
              </div>
              <span className="bg-green-100 text-green-700 text-[10px] font-bold rounded-full px-3 py-1">Doctor</span>
              {docProfile?.specialization && <div className="text-xs text-gray-500 text-center">{specializationLabel(docProfile.specialization, t)}</div>}
              {docProfile?.department && <div className="text-[11px] text-gray-400">{departmentLabel(docProfile.department, t)}</div>}
              <div className="text-[11px] text-gray-400">
                {src?.createdAt ? new Date(src.createdAt).toLocaleDateString() : '—'}
              </div>
            </div>

            {/* Availability card — on/off duty toggle (updates queue displays live) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">{t('doctorProfile.availabilityStatus')}</div>
              <button type="button" onClick={toggleAvailability} disabled={togglingAvail}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors border ${
                  availability ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                } disabled:opacity-60`}>
                {availability ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {availability ? t('doctorProfile.available') : t('doctorProfile.unavailable')}
              </button>
              <div className="text-[11px] text-gray-400 mt-2 text-center">
                {availability ? t('doctorProfile.availableHint') : t('doctorProfile.unavailableHint')}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* Account details card — read-only view, switches to a form when editing */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-base font-bold text-blue-900">{t('doctorProfile.accountDetails')}</span>
                {!editing ? (
                  <button type="button" onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors">
                    <Edit3 size={12} /> {t('doctorProfile.edit')}
                  </button>
                ) : (
                  <button type="button" onClick={() => { setEditing(false); setMsg({ text: '', error: false }); }}
                    className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors">
                    <X size={12} /> {t('doctorProfile.cancel')}
                  </button>
                )}
              </div>

              {!editing ? (
                <>
                  <Field icon={User} label={t('doctorProfile.name')} value={src?.name} />
                  <Field icon={Mail} label={t('doctorProfile.email')} value={src?.email} />
                  <Field icon={Phone} label={t('doctorProfile.phone')} value={src?.phone} />
                  <Field icon={CreditCard} label={t('doctorProfile.nic')} value={src?.NIC} />
                  <Field icon={Building2} label={t('doctorProfile.department')} value={departmentLabel(docProfile?.department, t)} />
                  <Field icon={Stethoscope} label={t('doctorProfile.specialization')} value={specializationLabel(docProfile?.specialization, t)} />
                </>
              ) : (
                <>
                  {msg.text && (
                    <div className={`rounded-xl p-3 text-sm mb-4 ${msg.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg.text}</div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className={labelClass}>{t('doctorProfile.name')}</label>
                      <input className={inputClass} value={form.name} onChange={set('name')} />
                    </div>
                    <div>
                      <label className={labelClass}>{t('doctorProfile.phone')}</label>
                      <input className={inputClass} value={form.phone} onChange={set('phone')} />
                    </div>
                    <div>
                      <label className={labelClass}>{t('doctorProfile.department')}</label>
                      <select className={inputClass} value={form.department}
                        onChange={(e) => setForm((current) => ({ ...current, department: e.target.value, specialization: '' }))}>
                        <option value="">{t('registerDoctor.selectDept')}</option>
                        {DEPARTMENTS.map((dept) => <option key={dept.key} value={dept.en}>{t(`departments.${dept.key}`)}</option>)}
                        {form.department && !DEPARTMENTS.some((dept) => dept.en === form.department) && (
                          <option value={form.department}>{departmentLabel(form.department, t)}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>{t('doctorProfile.specialization')}</label>
                      <select className={inputClass} value={form.specialization} onChange={set('specialization')}>
                        <option value="">{t('registerDoctor.selectSpec')}</option>
                        {(DEPARTMENTS.find((dept) => dept.en === form.department)?.specializations || []).map((spec) => (
                          <option key={spec.key} value={spec.en}>{t(`specializations.${spec.key}`)}</option>
                        ))}
                        {form.specialization &&
                          !(DEPARTMENTS.find((dept) => dept.en === form.department)?.specializations || [])
                            .some((spec) => spec.en === form.specialization) && (
                          <option value={form.specialization}>{specializationLabel(form.specialization, t)}</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Weekly schedule editor — add/remove day + time slots */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className={labelClass}>{t('doctorProfile.schedule')}</label>
                      <button type="button" onClick={addSlot}
                        className="flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 rounded-lg px-2.5 py-1 text-xs font-semibold hover:bg-green-100 transition-colors">
                        <Plus size={11} /> {t('doctorProfile.addSlot')}
                      </button>
                    </div>
                    {schedule.map((slot, i) => (
                      <div key={i} className="grid grid-cols-[1fr_90px_90px_36px] gap-2 mb-2">
                        <select value={slot.day} onChange={(e) => updateSlot(i, 'day', e.target.value)} className={slotInputClass}>
                          {DAYS.map((d) => <option key={d} value={d}>{t(`days.${d}`)}</option>)}
                        </select>
                        <input type="time" value={slot.startTime} onChange={(e) => updateSlot(i, 'startTime', e.target.value)} className={slotInputClass} />
                        <input type="time" value={slot.endTime} onChange={(e) => updateSlot(i, 'endTime', e.target.value)} className={slotInputClass} />
                        <button type="button" onClick={() => removeSlot(i)}
                          className="w-9 h-9 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {schedule.length === 0 && <div className="text-xs text-gray-400">{t('doctorProfile.noSlots')}</div>}
                  </div>

                  {/* Optional password change (left blank = keep current password) */}
                  <div className="border-t border-gray-100 pt-4 mt-2 mb-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-3">
                      <Key size={12} /> {t('doctorProfile.changePassword')}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>{t('doctorProfile.newPassword')}</label>
                        <input className={inputClass} type="password" value={form.password} onChange={set('password')} />
                      </div>
                      <div>
                        <label className={labelClass}>{t('doctorProfile.confirmPassword')}</label>
                        <input className={inputClass} type="password" value={form.confirmPassword} onChange={set('confirmPassword')} />
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:opacity-60">
                    <Save size={14} /> {saving ? t('doctorProfile.saving') : t('doctorProfile.save')}
                  </button>
                </>
              )}
            </div>

            {/* Read-only weekly schedule summary (view mode only) */}
            {!editing && schedule.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="text-base font-bold text-blue-900 mb-3">{t('doctorProfile.schedule')}</div>
                <div className="space-y-2">
                  {schedule.map((slot, i) => (
                    <div key={i} className="flex justify-between items-center px-3 py-2 bg-blue-50 rounded-xl">
                      <span className="text-sm font-semibold text-blue-900">{t(`days.${slot.day}`)}</span>
                      <span className="text-sm text-gray-500">{slot.startTime} – {slot.endTime}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorProfile;
