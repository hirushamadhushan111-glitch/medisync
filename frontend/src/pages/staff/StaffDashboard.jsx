/**
 * StaffDashboard.jsx — the reception home page.
 * Today's appointment stat cards, a patient autocomplete search, and
 * quick links to the register/walk-in/queue pages.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { appointmentService } from '../../api';
import { clinicDisplayName } from '../../utils/clinicTypes';
import PatientSearchInput from '../../components/PatientSearchInput.jsx';
import Toast from '../../components/Toast.jsx';

// Page component.
const StaffDashboard = () => {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // Stat cards show TODAY's appointments only — all-time totals are
    // misleading on a reception dashboard (old bookings kept inflating them).
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    appointmentService.getAll({ date: today })
      .then((appointments) => setAppointments(appointments))
      .catch((err) => setError(err.response?.data?.message || t('common.error')));
  }, []);

  // Autocomplete handles searching; picking a suggestion lists that patient
  const handleSelect = (patient) => {
    setPatients((prev) => [patient, ...prev.filter((p) => p._id !== patient._id)]);
  };

  const confirmed = appointments.filter((item) => item.status === 'confirmed').length;
  const completed = appointments.filter((item) => item.status === 'completed').length;

  // Data for the three stat cards (today's appointments / confirmed / completed).
  const statCards = [
    {
      label: t('staffDashboard.appointments'),
      value: appointments.length,
      iconBg: 'bg-blue-900',
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
          <path stroke="#fff" strokeWidth="1.5" strokeLinecap="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>
        </svg>
      ),
    },
    {
      label: t('staffDashboard.confirmed'),
      value: confirmed,
      iconBg: 'bg-green-500',
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
          <path stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5"/>
        </svg>
      ),
    },
    {
      label: t('staffDashboard.completed'),
      value: completed,
      iconBg: 'bg-amber-400',
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="#1E3A8A" strokeWidth="1.5"/>
          <path stroke="#1E3A8A" strokeWidth="1.5" strokeLinecap="round" d="M12 6v6l4 2"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h1 className="text-2xl font-bold text-blue-900 m-0">{t('staffDashboard.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('staffDashboard.subtitle')}</p>
          </div>
          {/* Quick links to the three main staff jobs */}
          <div className="flex flex-wrap gap-2">
            <Link className="bg-amber-400 hover:bg-amber-500 text-blue-900 font-bold rounded-xl px-4 py-2 text-sm no-underline transition-colors" to="/staff/walk-in-booking">
              {t('staffDashboard.walkInBtn')}
            </Link>
            <Link className="bg-white hover:bg-blue-50 text-blue-700 font-semibold border border-blue-200 rounded-xl px-4 py-2 text-sm no-underline transition-colors" to="/staff/register-patient">
              {t('staffDashboard.registerPatient')}
            </Link>
            <Link className="bg-white hover:bg-blue-50 text-blue-700 font-semibold border border-blue-200 rounded-xl px-4 py-2 text-sm no-underline transition-colors" to="/staff/register-doctor">
              {t('staffDashboard.registerDoctor')}
            </Link>
          </div>
        </div>

        <Toast error={error} onClearError={() => setError('')} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {statCards.map(({ label, value, iconBg, icon }) => (
            <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
              <div>
                <div className="text-3xl font-bold text-blue-900 leading-none">{value}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mt-1">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Patient search card — picked patients pile up in the list below,
            each showing their registered-clinic chips */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="text-blue-900 font-bold text-lg mb-3">{t('staffDashboard.searchPatient')}</div>
          <div className="mb-4">
            <PatientSearchInput placeholder={t('staffDashboard.searchPlaceholder')} onSelect={handleSelect} />
          </div>
          {patients.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-6">{t('staffDashboard.noPatients')}</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {patients.map((patient) => (
                <div key={patient._id} className="flex justify-between items-center py-3 hover:bg-blue-50/50 rounded-lg px-2 transition-colors gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{patient.userId?.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{patient.NIC} · {patient.userId?.phone}</div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {(patient.registeredClinics || []).length > 0
                      ? patient.registeredClinics.map((clinic) => (
                          <span key={clinic?._id || clinic} className="text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                            {clinicDisplayName(clinic, t)}
                          </span>
                        ))
                      : (
                        <span className="text-xs bg-blue-50 text-blue-700 font-medium rounded-full px-2.5 py-0.5 border border-blue-100">
                          {t('staffDashboard.patientBadge')}
                        </span>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
