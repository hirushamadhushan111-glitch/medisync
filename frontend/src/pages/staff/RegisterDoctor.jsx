/**
 * RegisterDoctor.jsx — staff/admin page for creating a doctor account.
 *
 * QA standard (see utils/validators.js — shared by all register forms):
 *  - Every field is required (name, email, password, NIC, phone,
 *    department, specialization, and at least one consultation day).
 *  - Email must be a valid email, password ≥ 6 characters,
 *    phone exactly 10 digits, NIC in Sri Lankan format.
 *
 * The same rules are re-checked on the server (authController.createUser).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authService } from '../../api';
import { DEPARTMENTS } from '../../utils/departments';
import { withDrPrefix } from '../../utils/names';
import { getAccountFieldError } from '../../utils/validators';
import Toast from '../../components/Toast.jsx';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const initialForm = { name: '', email: '', password: '', NIC: '', phone: '', department: '', specialization: '', selectedDays: [], startTime: '08:00', endTime: '17:00' };

const inputClass = 'w-full h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-gray-400';
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';

// Page component.
const RegisterDoctor = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Update one form field (changing department resets specialization).
  const update = (field, value) => {
    setForm((current) => {
      const updated = { ...current, [field]: value };
      if (field === 'department') updated.specialization = '';
      return updated;
    });
  };

  // Tick/untick a consultation day.
  const toggleDay = (day) => {
    setForm((current) => ({
      ...current,
      selectedDays: current.selectedDays.includes(day)
        ? current.selectedDays.filter((item) => item !== day)
        : [...current.selectedDays, day],
    }));
  };

  // Validate (QA rules) then create the doctor account.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(''); setMessage('');

    // Shared format rules: valid email, password ≥ 6, phone = 10 digits, SL NIC.
    const accountError = getAccountFieldError(form, t);
    if (accountError) { setError(accountError); return; }

    // Doctor-specific required fields.
    if (!form.department || !form.specialization) { setError(t('registerDoctor.deptSpecRequired')); return; }
    if (form.selectedDays.length === 0) { setError(t('validation.noDaysSelected')); return; }
    try {
      setLoading(true);
      await authService.createUser({
        name: withDrPrefix(form.name), email: form.email, password: form.password, NIC: form.NIC, phone: form.phone,
        role: 'doctor', department: form.department, specialization: form.specialization,
        consultationSchedule: form.selectedDays.map((day) => ({ day, startTime: form.startTime, endTime: form.endTime })),
      });
      setForm(initialForm);
      setMessage(t('registerDoctor.created'));
    } catch (err) {
      setError(err.response?.data?.message || t('registerDoctor.failed'));
    } finally {
      setLoading(false);
    }
  };

  const selectedDept = DEPARTMENTS.find((dept) => dept.en === form.department);
  const specializations = selectedDept ? selectedDept.specializations : [];

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">{t('registerDoctor.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('registerDoctor.subtitle')}</p>
        </div>

        <Toast error={error} message={message} onClearError={() => setError('')} onClearMessage={() => setMessage('')} />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-3xl">
          <form onSubmit={handleSubmit}>
            {/* Account fields — the name input shows a fixed "Dr." prefix
                (withDrPrefix adds it on submit, so it's never typed twice) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {[
                ['name', t('registerDoctor.name'), 'text'],
                ['email', t('registerDoctor.email'), 'email'],
                ['password', t('registerDoctor.password'), 'password'],
                ['NIC', t('registerDoctor.nic'), 'text'],
                ['phone', t('registerDoctor.phone'), 'text'],
              ].map(([field, label, type]) => (
                <div key={field}>
                  <label className={labelClass} htmlFor={field}>{label}</label>
                  {field === 'name' ? (
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 pointer-events-none">Dr.</span>
                      <input id={field} className={`${inputClass} pl-11`} type={type} value={form[field]}
                        onChange={(e) => update(field, e.target.value)} required />
                    </div>
                  ) : (
                    <input id={field} className={inputClass} type={type} value={form[field]}
                      onChange={(e) => update(field, e.target.value)} required />
                  )}
                </div>
              ))}
            </div>

            {/* Department → specialization (second dropdown depends on the first) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass} htmlFor="department">{t('registerDoctor.department')} <span className="text-red-500">*</span></label>
                <select id="department" className={inputClass} value={form.department} onChange={(e) => update('department', e.target.value)} required>
                  <option value="">{t('registerDoctor.selectDept')}</option>
                  {DEPARTMENTS.map((dept) => <option key={dept.key} value={dept.en}>{t(`departments.${dept.key}`)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="specialization">{t('registerDoctor.specialization')} <span className="text-red-500">*</span></label>
                <select id="specialization" className={inputClass} value={form.specialization}
                  onChange={(e) => update('specialization', e.target.value)} disabled={!form.department} required>
                  <option value="">{form.department ? t('registerDoctor.selectSpec') : t('registerDoctor.selectDeptFirst')}</option>
                  {specializations.map((spec) => <option key={spec.key} value={spec.en}>{t(`specializations.${spec.key}`)}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className={labelClass} htmlFor="startTime">{t('registerDoctor.startTime')}</label>
                <input id="startTime" type="time" className={inputClass} value={form.startTime} onChange={(e) => update('startTime', e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="endTime">{t('registerDoctor.endTime')}</label>
                <input id="endTime" type="time" className={inputClass} value={form.endTime} onChange={(e) => update('endTime', e.target.value)} />
              </div>
            </div>

            {/* Consultation days — toggle chips; each selected day gets the
                start/end times above as its weekly schedule slot */}
            <div className="mb-5">
              <div className={`${labelClass} mb-2`}>{t('registerDoctor.consultDays')}</div>
              <div className="flex flex-wrap gap-2">
                {days.map((day) => (
                  <button key={day} type="button" onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      form.selectedDays.includes(day)
                        ? 'bg-blue-900 text-white border-blue-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}>
                    {t(`days.${day}`)}
                  </button>
                ))}
              </div>
            </div>

            <button className="h-11 px-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-60"
              type="submit" disabled={loading}>
              {loading ? t('registerDoctor.creating') : t('registerDoctor.createBtn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterDoctor;
