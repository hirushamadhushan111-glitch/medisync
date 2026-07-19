/**
 * RegisterPatient.jsx — staff/admin page for creating a patient account.
 *
 * QA standard (see utils/validators.js — shared by all register forms):
 *  - EVERY field is required, including the emergency contact.
 *  - Email must be a valid email, password ≥ 6 characters,
 *    phone numbers exactly 10 digits, NIC in Sri Lankan format.
 *  - The patient must be registered to at least one clinic.
 *
 * Validation happens twice: HTML `required` + validators.js here in the
 * browser, and again in backend/controllers/authController.js on the server.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Stethoscope } from 'lucide-react';
import { authService, clinicService } from '../../api';
import { clinicDisplayName } from '../../utils/clinicTypes';
import { getAccountFieldError, isValidPhone } from '../../utils/validators';
import Toast from '../../components/Toast.jsx';

// One state object for the whole form — gender starts empty so the user is
// forced to make an explicit choice (the <select> is required).
const initialForm = {
  name: '', email: '', password: '', NIC: '', phone: '', dateOfBirth: '',
  gender: '', age: '', weight: '', height: '', address: '', bloodGroup: '',
  emergencyContactName: '', emergencyContactPhone: '',
};

// Shared Tailwind classes so every input/label looks identical.
const inputClass = 'w-full h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-gray-400';
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';

// Red asterisk shown next to every label — all fields are mandatory.
const RequiredMark = () => <span className="text-red-500"> *</span>;

// Small heading that separates the form into sections.
const SectionLabel = ({ children }) => (
  <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-100 mt-5 mb-3">{children}</div>
);

// Page component.
const RegisterPatient = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState(initialForm);
  const [clinics, setClinics] = useState([]);
  const [selectedClinics, setSelectedClinics] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load the active clinics once, for the clinic-selection cards.
  useEffect(() => {
    clinicService.getActive().then(setClinics).catch(() => {});
  }, []);

  // Generic single-field updater — avoids one handler per input.
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  // Add/remove a clinic from the selection when its card is clicked.
  const toggleClinic = (clinicId) =>
    setSelectedClinics((current) =>
      current.includes(clinicId) ? current.filter((id) => id !== clinicId) : [...current, clinicId]
    );

  // Validate everything, then create the account + patient profile.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(''); setMessage('');

    // Empty fields are already blocked by the HTML `required` attributes;
    // here we check the FORMAT rules (email / password / phone / NIC).
    const accountError = getAccountFieldError(form, t);
    if (accountError) { setError(accountError); return; }

    // Emergency contact phone follows the same 10-digit rule.
    if (!isValidPhone(form.emergencyContactPhone)) { setError(t('validation.invalidEcPhone')); return; }

    // Every patient must belong to at least one clinic.
    if (selectedClinics.length === 0) { setError(t('registerPatient.clinicRequired')); return; }

    try {
      setLoading(true);
      await authService.createUser({
        name: form.name, email: form.email, password: form.password, NIC: form.NIC, phone: form.phone,
        role: 'patient', dateOfBirth: form.dateOfBirth, gender: form.gender,
        age: Number(form.age), weight: Number(form.weight), height: Number(form.height),
        address: form.address, bloodGroup: form.bloodGroup,
        emergencyContact: { name: form.emergencyContactName, phone: form.emergencyContactPhone },
        registeredClinics: selectedClinics,
      });
      // Success — clear the form so the next patient can be entered.
      setForm(initialForm);
      setSelectedClinics([]);
      setMessage(t('registerPatient.created'));
    } catch (err) {
      setError(err.response?.data?.message || t('registerPatient.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">{t('registerPatient.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('registerPatient.subtitle')}</p>
        </div>

        <Toast error={error} message={message} onClearError={() => setError('')} onClearMessage={() => setMessage('')} />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-3xl">
          <form onSubmit={handleSubmit}>
            {/* ── Clinic registration (at least one clinic) ── */}
            <SectionLabel>{t('registerPatient.clinicSection')}<RequiredMark /></SectionLabel>
            <p className="text-xs text-gray-400 -mt-1 mb-3">{t('registerPatient.clinicHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {clinics.map((clinic) => {
                const selected = selectedClinics.includes(clinic._id);
                return (
                  <button type="button" key={clinic._id} onClick={() => toggleClinic(clinic._id)}
                    className={`text-left rounded-xl border-2 p-3.5 transition-all ${selected
                      ? 'border-blue-600 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/40'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selected ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}>
                        <Stethoscope size={16} />
                      </div>
                      {selected && <CheckCircle2 size={18} className="text-blue-600 flex-shrink-0" />}
                    </div>
                    <div className="text-sm font-bold text-blue-900 mt-2 leading-snug">{clinicDisplayName(clinic, t)}</div>
                  </button>
                );
              })}
            </div>

            {/* ── Account credentials ── */}
            <SectionLabel>{t('registerPatient.accountCreds')}</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ['name', t('registerPatient.name'), 'text'],
                ['email', t('registerPatient.email'), 'email'],
                ['password', t('registerPatient.password'), 'password'],
              ].map(([id, label, type]) => (
                <div key={id}>
                  <label className={labelClass} htmlFor={id}>{label}<RequiredMark /></label>
                  <input id={id} className={inputClass} type={type} value={form[id]}
                    onChange={(e) => update(id, e.target.value)} required />
                </div>
              ))}
            </div>

            {/* ── Identity & contact — every field mandatory ── */}
            <SectionLabel>{t('registerPatient.identityContact')}</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ['NIC', t('registerPatient.nic'), 'text'],
                ['phone', t('registerPatient.phone'), 'text'],
                ['dateOfBirth', t('registerPatient.dob'), 'date'],
                ['age', t('registerPatient.age'), 'number'],
                ['weight', t('registerPatient.weight'), 'number'],
                ['height', t('registerPatient.height'), 'number'],
              ].map(([id, label, type]) => (
                <div key={id}>
                  <label className={labelClass} htmlFor={id}>{label}<RequiredMark /></label>
                  <input id={id} className={inputClass} type={type} value={form[id]}
                    onChange={(e) => update(id, e.target.value)} required />
                </div>
              ))}
              <div>
                <label className={labelClass} htmlFor="gender">{t('registerPatient.gender')}<RequiredMark /></label>
                <select id="gender" className={inputClass} value={form.gender}
                  onChange={(e) => update('gender', e.target.value)} required>
                  <option value="">{t('registerPatient.selectGender')}</option>
                  <option value="female">{t('profile.female')}</option>
                  <option value="male">{t('profile.male')}</option>
                  <option value="other">{t('profile.other')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="bloodGroup">{t('registerPatient.bloodGroup')}<RequiredMark /></label>
                <select id="bloodGroup" className={inputClass} value={form.bloodGroup}
                  onChange={(e) => update('bloodGroup', e.target.value)} required>
                  <option value="">{t('registerPatient.selectBloodGroup')}</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Address ── */}
            <SectionLabel>{t('registerPatient.address')}<RequiredMark /></SectionLabel>
            <textarea id="address" className={`${inputClass} h-20 py-2.5 resize-y`} rows="3"
              value={form.address} onChange={(e) => update('address', e.target.value)} required />

            {/* ── Emergency contact — mandatory, phone must be 10 digits ── */}
            <SectionLabel>{t('registerPatient.emergencyContact')}</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="emergencyContactName">{t('registerPatient.ecName')}<RequiredMark /></label>
                <input id="emergencyContactName" className={inputClass} value={form.emergencyContactName}
                  onChange={(e) => update('emergencyContactName', e.target.value)} required />
              </div>
              <div>
                <label className={labelClass} htmlFor="emergencyContactPhone">{t('registerPatient.ecPhone')}<RequiredMark /></label>
                <input id="emergencyContactPhone" className={inputClass} value={form.emergencyContactPhone}
                  onChange={(e) => update('emergencyContactPhone', e.target.value)} required />
              </div>
            </div>

            <button className="mt-6 h-11 px-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-60"
              type="submit" disabled={loading}>
              {loading ? t('registerPatient.creating') : t('registerPatient.createBtn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPatient;
