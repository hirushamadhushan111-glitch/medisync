/**
 * ClinicPatients.jsx — admin/staff view of one clinic's people.
 *
 * Pick a clinic card, then browse its registered patients (searchable)
 * and today's appointments. Staff can also register an existing patient
 * into this clinic, and doctors get an assign-to-me shortcut.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Users, CalendarCheck, HeartPulse, Droplets, Stethoscope,
  Phone, CreditCard, Clock, Eye, UserPlus, ArrowRightLeft,
} from 'lucide-react';
import { clinicService, patientService, doctorService } from '../../api';
import { clinicDisplayName, clinicTypeKey } from '../../utils/clinicTypes';
import { departmentLabel, specializationLabel } from '../../utils/departments';
import { withDrPrefix } from '../../utils/names';
import { useAuth } from '../../context/AuthContext.jsx';
import { useClinic } from '../../context/ClinicContext.jsx';
import PatientSearchInput from '../../components/PatientSearchInput.jsx';
import Toast from '../../components/Toast.jsx';

// Date → 'YYYY-MM-DD' (local time, no timezone shift).
const toDateStr = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Per-clinic-type look: icon + colour accents for the selector cards
const CLINIC_STYLES = {
  cardiology: { icon: HeartPulse,  chip: 'bg-rose-100 text-rose-600',       selected: 'border-rose-500 ring-rose-200 bg-rose-50' },
  diabetic:   { icon: Droplets,    chip: 'bg-emerald-100 text-emerald-600', selected: 'border-emerald-500 ring-emerald-200 bg-emerald-50' },
  opd:        { icon: Stethoscope, chip: 'bg-blue-100 text-blue-600',       selected: 'border-blue-500 ring-blue-200 bg-blue-50' },
  eye:        { icon: Eye,         chip: 'bg-sky-100 text-sky-700',         selected: 'border-sky-500 ring-sky-200 bg-sky-50' },
};
// Icon/colour set for a clinic card (by clinic type).
const styleFor = (clinic) =>
  CLINIC_STYLES[clinicTypeKey(clinic.departmentType) || clinicTypeKey(clinic.clinicName)] || CLINIC_STYLES.opd;

const STATUS_STYLES = {
  pending:   'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

// Initial-letter avatar circle.
const Avatar = ({ name }) => (
  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
    {name?.[0]?.toUpperCase() || '?'}
  </div>
);

// Page component.
const ClinicPatients = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'si' ? 'si-LK' : 'en-US';
  const { activeClinic, setActiveClinic } = useClinic();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patientsByClinic, setPatientsByClinic] = useState({});
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState('patients');
  const [tab, setTab] = useState('patients');
  const [message, setMessage] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [assignId, setAssignId] = useState('');
  const [date, setDate] = useState(toDateStr(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addMsg, setAddMsg] = useState({ text: '', error: false });

  // Fetch the selected clinic's patients + today's appointments.
  const loadPatients = async (activeList) => {
    const lists = await Promise.all(activeList.map((clinic) => clinicService.getPatients(clinic._id)));
    const map = {};
    activeList.forEach((clinic, index) => { map[clinic._id] = lists[index]; });
    setPatientsByClinic(map);
  };

  // Load the clinics plus each clinic's registered patients (4 clinics → light)
  useEffect(() => {
    (async () => {
      try {
        const [active, allDoctors] = await Promise.all([
          clinicService.getActive(),
          doctorService.getAll(),
        ]);
        setClinics(active);
        setDoctors(allDoctors);
        await loadPatients(active);
        if (active.length > 0) setSelectedId(active[0]._id);
      } catch (err) {
        setError(err.response?.data?.message || t('common.error'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Doctor assignment (admin) ────────────────────────────────────

  const clinicDoctorIds = (clinic) =>
    (clinic?.assignedDoctors || []).map((doctor) => (doctor?._id || doctor).toString());

  // Refresh the clinic cards (e.g. after a doctor assignment).
  const reloadClinics = async () => {
    const active = await clinicService.getActive();
    setClinics(active);
  };

  // Assign a doctor to this clinic.
  const assignDoctor = async () => {
    if (!assignId) return;
    setError(''); setMessage('');
    const clinic = clinics.find((c) => c._id === selectedId);
    try {
      await clinicService.update(selectedId, { assignedDoctors: [...clinicDoctorIds(clinic), assignId] });
      const doctor = doctors.find((d) => d._id === assignId);
      setMessage(`${withDrPrefix(doctor?.userId?.name)} — ${t('clinicPatients.doctorAssigned')}`);
      setAssignId('');
      await reloadClinics();
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    }
  };

  // Remove a doctor from this clinic.
  const removeDoctor = async (doctorId) => {
    if (!window.confirm(t('clinicPatients.removeDoctorConfirm'))) return;
    setError(''); setMessage('');
    const clinic = clinics.find((c) => c._id === selectedId);
    try {
      await clinicService.update(selectedId, {
        assignedDoctors: clinicDoctorIds(clinic).filter((id) => id !== doctorId),
      });
      const doctor = doctors.find((d) => d._id === doctorId);
      setMessage(`${withDrPrefix(doctor?.userId?.name)} — ${t('clinicPatients.doctorRemoved')}`);
      await reloadClinics();
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    }
  };

  // Move a doctor here from another clinic.
  const moveDoctor = async (doctorId, targetClinicId) => {
    if (!targetClinicId) return;
    setError(''); setMessage('');
    const source = clinics.find((c) => c._id === selectedId);
    const target = clinics.find((c) => c._id === targetClinicId);
    try {
      await clinicService.update(selectedId, {
        assignedDoctors: clinicDoctorIds(source).filter((id) => id !== doctorId),
      });
      const targetIds = clinicDoctorIds(target);
      if (!targetIds.includes(doctorId)) {
        await clinicService.update(targetClinicId, { assignedDoctors: [...targetIds, doctorId] });
      }
      const doctor = doctors.find((d) => d._id === doctorId);
      setMessage(`${withDrPrefix(doctor?.userId?.name)} — ${t('clinicPatients.doctorMoved')} ${clinicDisplayName(target, t)}`);
      await reloadClinics();
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    }
  };

  // Register an EXISTING patient to the currently selected clinic —
  // patients can belong to several clinics at once (multiple conditions).
  const addPatientToClinic = async (patient) => {
    setAddMsg({ text: '', error: false });
    // Doctor ids already assigned to the selected clinic.
    const currentIds = (patient.registeredClinics || []).map((c) => c?._id || c);
    if (currentIds.includes(selectedId)) {
      setAddMsg({ text: t('clinicPatients.alreadyInClinic'), error: true });
      return;
    }
    try {
      await patientService.addToClinic(patient._id, selectedId);
      await loadPatients(clinics);
      setAddMsg({ text: `${patient.userId?.name} — ${t('clinicPatients.addedToClinic')}`, error: false });
    } catch (err) {
      setAddMsg({ text: err.response?.data?.message || t('common.error'), error: true });
    }
  };

  // Follow the navbar clinic selector (shared active clinic)
  useEffect(() => {
    if (activeClinic?._id && clinics.some((c) => c._id === activeClinic._id)) {
      setSelectedId(activeClinic._id);
    }
  }, [activeClinic, clinics]);

  // Load the selected clinic's appointments whenever clinic/date changes
  useEffect(() => {
    if (!selectedId) return;
    setLoadingAppts(true);
    clinicService.getAppointments(selectedId, date)
      .then(setAppointments)
      .catch((err) => setError(err.response?.data?.message || t('common.error')))
      .finally(() => setLoadingAppts(false));
  }, [selectedId, date]);

  const selectedClinic = clinics.find((clinic) => clinic._id === selectedId);
  const patients = patientsByClinic[selectedId] || [];

  const selectedDoctorIds = clinicDoctorIds(selectedClinic);
  const clinicDoctors = doctors.filter((doctor) => selectedDoctorIds.includes(doctor._id.toString()));
  const unassignedDoctors = doctors.filter((doctor) => !selectedDoctorIds.includes(doctor._id.toString()));
  // Which clinics a doctor is currently assigned to.
  const doctorClinicsOf = (doctorId) => clinics.filter((clinic) => clinicDoctorIds(clinic).includes(doctorId));

  const filteredPatients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter((patient) =>
      [patient.userId?.name, patient.NIC, patient.userId?.phone]
        .some((value) => value?.toLowerCase().includes(term))
    );
  }, [patients, search]);

  const dateLabel = new Date(date).toLocaleDateString(locale, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6 max-w-6xl">
        <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">{t('clinicPatients.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('clinicPatients.subtitle')}</p>
          </div>
          {/* Patients / Doctors view switch */}
          <select value={mode} onChange={(e) => { setMode(e.target.value); setShowAssign(false); }}
            className="h-10 border border-gray-200 rounded-xl px-4 text-sm font-semibold bg-white text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm">
            <option value="patients">{t('clinicPatients.modePatients')}</option>
            <option value="doctors">{t('clinicPatients.modeDoctors')}</option>
          </select>
        </div>

        <Toast error={error} message={message} onClearError={() => setError('')} onClearMessage={() => setMessage('')} />

        {loading ? (
          <div className="text-sm text-gray-400 py-12 text-center">{t('common.loading')}</div>
        ) : (
          <>
            {/* ── Clinic selector cards ─────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              {clinics.map((clinic) => {
                const { icon: Icon, chip, selected } = styleFor(clinic);
                const isSelected = clinic._id === selectedId;
                const count = mode === 'doctors'
                  ? clinicDoctorIds(clinic).length
                  : (patientsByClinic[clinic._id] || []).length;
                return (
                  <button type="button" key={clinic._id} onClick={() => { setSelectedId(clinic._id); setActiveClinic(clinic); }}
                    className={`text-left rounded-2xl border-2 p-5 transition-all bg-white ${isSelected
                      ? `${selected} ring-2 shadow-md`
                      : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'}`}>
                    <div className="flex items-center justify-between">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${chip}`}>
                        <Icon size={22} />
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-extrabold text-blue-900">{count}</div>
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                          {mode === 'doctors' ? t('clinicPatients.doctorsCount') : t('clinicPatients.patientsCount')}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-blue-900 mt-3 leading-snug">{clinicDisplayName(clinic, t)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {clinic.openingHours?.start} – {clinic.openingHours?.end}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Tabs + content ────────────────────────────────── */}
            {mode === 'patients' ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between flex-wrap gap-3 px-5 pt-4 border-b border-gray-100">
                <div className="flex gap-1">
                  {[
                    { id: 'patients', icon: Users,         label: t('clinicPatients.patientsTab') },
                    { id: 'appts',    icon: CalendarCheck, label: t('clinicPatients.apptsTab') },
                  ].map(({ id, icon: Icon, label }) => (
                    <button type="button" key={id} onClick={() => setTab(id)}
                      className={`flex items-center gap-2 px-4 pb-3 pt-1 text-sm font-bold border-b-2 -mb-px transition-colors ${tab === id
                        ? 'border-blue-600 text-blue-900'
                        : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                      <Icon size={15} />
                      {label}
                      <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${tab === id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                        {id === 'patients' ? filteredPatients.length : appointments.length}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pb-3 flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  {tab === 'patients' ? (
                    <>
                      <div className="relative flex-1 sm:flex-none min-w-[150px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)}
                          placeholder={t('clinicPatients.searchPlaceholder')}
                          className="h-9 w-full sm:w-64 border border-gray-200 rounded-xl pl-8 pr-3 text-xs bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                      </div>
                      <button type="button" onClick={() => { setShowAdd((v) => !v); setAddMsg({ text: '', error: false }); }}
                        className="flex items-center gap-1.5 h-9 px-3 bg-amber-400 hover:bg-amber-500 text-blue-900 text-xs font-bold rounded-xl transition-colors flex-shrink-0">
                        <UserPlus size={13} /> {t('clinicPatients.addExisting')}
                      </button>
                    </>
                  ) : (
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                      className="h-9 border border-gray-200 rounded-xl px-3 text-xs bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
                  )}
                </div>
              </div>

              {/* Add an existing patient to this clinic (staff/admin) */}
              {tab === 'patients' && showAdd && (
                <div className="px-5 py-3 border-b border-gray-100 bg-blue-50/40">
                  <div className="text-xs font-semibold text-gray-600 mb-2">
                    {t('clinicPatients.addExistingHint')} — <span className="text-blue-700 font-bold">{selectedClinic && clinicDisplayName(selectedClinic, t)}</span>
                  </div>
                  <div className="max-w-md">
                    <PatientSearchInput placeholder={t('clinicPatients.searchPlaceholder')} onSelect={addPatientToClinic} />
                  </div>
                  {addMsg.text && (
                    <div className={`mt-2 text-xs font-semibold ${addMsg.error ? 'text-red-600' : 'text-green-700'}`}>{addMsg.text}</div>
                  )}
                </div>
              )}

              {/* ── Registered patients ─────────────────────────── */}
              {tab === 'patients' && (
                filteredPatients.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 text-sm">{t('clinicPatients.noPatients')}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
                          <th className="px-5 py-3 font-semibold">{t('clinicPatients.patient')}</th>
                          <th className="px-4 py-3 font-semibold">{t('clinicPatients.nic')}</th>
                          <th className="px-4 py-3 font-semibold">{t('clinicPatients.phone')}</th>
                          <th className="px-4 py-3 font-semibold hidden sm:table-cell">{t('clinicPatients.genderAge')}</th>
                          <th className="px-4 py-3 font-semibold hidden md:table-cell">{t('clinicPatients.blood')}</th>
                          <th className="px-4 py-3 font-semibold hidden md:table-cell">{t('clinicPatients.clinics')}</th>
                          <th className="px-4 py-3 font-semibold hidden lg:table-cell">{t('clinicPatients.registeredOn')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPatients.map((patient) => (
                          <tr key={patient._id} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar name={patient.userId?.name} />
                                <div className="font-semibold text-gray-900">{patient.userId?.name}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              <span className="inline-flex items-center gap-1.5"><CreditCard size={13} className="text-gray-300" />{patient.NIC}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              <span className="inline-flex items-center gap-1.5"><Phone size={13} className="text-gray-300" />{patient.userId?.phone || '—'}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 capitalize hidden sm:table-cell">
                              {patient.gender !== 'not-specified' ? t(`profile.${patient.gender}`, patient.gender) : '—'}
                              {patient.age ? ` · ${patient.age}` : ''}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              {patient.bloodGroup
                                ? <span className="text-[11px] font-bold bg-red-50 text-red-600 rounded-full px-2 py-0.5">{patient.bloodGroup}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <div className="flex flex-wrap gap-1 max-w-[180px]">
                                {(patient.registeredClinics || []).map((clinic) => {
                                  const cid = clinic?._id || clinic;
                                  const isCurrent = cid === selectedId;
                                  return (
                                    <span key={cid}
                                      className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${isCurrent ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                      {clinicDisplayName(clinic, t) || '—'}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                              {new Date(patient.createdAt).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* ── Day's appointments ──────────────────────────── */}
              {tab === 'appts' && (
                <div>
                  <div className="px-5 pt-4 text-xs text-gray-400">
                    {selectedClinic && clinicDisplayName(selectedClinic, t)} — {dateLabel}
                  </div>
                  {loadingAppts ? (
                    <div className="p-10 text-center text-gray-400 text-sm">{t('common.loading')}</div>
                  ) : appointments.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 text-sm">{t('clinicPatients.noAppts')}</div>
                  ) : (
                    <div className="overflow-x-auto mt-2">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
                            <th className="px-5 py-3 font-semibold">{t('clinicPatients.queueNo')}</th>
                            <th className="px-4 py-3 font-semibold">{t('clinicPatients.patient')}</th>
                            <th className="px-4 py-3 font-semibold hidden md:table-cell">{t('clinicPatients.nic')}</th>
                            <th className="px-4 py-3 font-semibold hidden md:table-cell">{t('clinicPatients.doctor')}</th>
                            <th className="px-4 py-3 font-semibold">{t('clinicPatients.time')}</th>
                            <th className="px-4 py-3 font-semibold hidden sm:table-cell">{t('clinicPatients.type')}</th>
                            <th className="px-4 py-3 font-semibold">{t('clinicPatients.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {appointments.map((appt) => (
                            <tr key={appt._id} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                              <td className="px-5 py-3">
                                <span className="inline-flex items-center justify-center w-9 h-7 rounded-lg bg-blue-900 text-white text-xs font-extrabold">
                                  #{appt.queueNumber ?? '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <Avatar name={appt.patientId?.userId?.name} />
                                  <span className="font-semibold text-gray-900">{appt.patientId?.userId?.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{appt.patientId?.NIC}</td>
                              <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{withDrPrefix(appt.doctorId?.userId?.name)}</td>
                              <td className="px-4 py-3 text-gray-600">
                                <span className="inline-flex items-center gap-1.5"><Clock size={13} className="text-gray-300" />{appt.appointmentTime}</span>
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${appt.bookingType === 'walk-in' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {appt.bookingType === 'walk-in' ? t('apptMgmt.walkIn') : t('apptMgmt.online')}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${STATUS_STYLES[appt.status] || 'bg-gray-100 text-gray-500'}`}>
                                  {t(`apptMgmt.status_${appt.status}`, appt.status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            ) : (
            /* ── Assigned doctors (Doctors view) ─────────────────── */
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
                  <Stethoscope size={16} />
                  {t('clinicPatients.doctorsTab')}
                  <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-blue-100 text-blue-700">{clinicDoctors.length}</span>
                  <span className="text-xs font-semibold text-gray-400">— {selectedClinic && clinicDisplayName(selectedClinic, t)}</span>
                </div>
                {isAdmin && (
                  <button type="button" onClick={() => { setShowAssign((v) => !v); setAssignId(''); }}
                    className="flex items-center gap-1.5 h-9 px-3 bg-amber-400 hover:bg-amber-500 text-blue-900 text-xs font-bold rounded-xl transition-colors">
                    <UserPlus size={13} /> {t('clinicPatients.assignDoctor')}
                  </button>
                )}
              </div>

              {/* Assign a doctor to this clinic (admin) */}
              {isAdmin && showAssign && (
                <div className="px-5 py-3 border-b border-gray-100 bg-blue-50/40">
                  <div className="text-xs font-semibold text-gray-600 mb-2">
                    {t('clinicPatients.assignDoctorHint')} — <span className="text-blue-700 font-bold">{selectedClinic && clinicDisplayName(selectedClinic, t)}</span>
                  </div>
                  {unassignedDoctors.length === 0 ? (
                    <div className="text-xs text-gray-400">{t('clinicPatients.allAssigned')}</div>
                  ) : (
                    <div className="flex items-center gap-2 max-w-md">
                      <select value={assignId} onChange={(e) => setAssignId(e.target.value)}
                        className="flex-1 h-9 border border-gray-200 rounded-xl px-3 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
                        <option value="">{t('clinicSchedule.selectDoctor')}</option>
                        {unassignedDoctors.map((doctor) => (
                          <option key={doctor._id} value={doctor._id}>
                            {withDrPrefix(doctor.userId?.name)} — {specializationLabel(doctor.specialization, t)}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={assignDoctor} disabled={!assignId}
                        className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50">
                        {t('clinicPatients.assignBtn')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Doctors table — admin gets Move-to and Remove controls per row */}
              {clinicDoctors.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">{t('clinicPatients.noDoctors')}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] text-gray-400 uppercase tracking-wide border-b border-gray-100">
                        <th className="px-5 py-3 font-semibold">{t('clinicPatients.doctor')}</th>
                        <th className="px-4 py-3 font-semibold hidden md:table-cell">{t('clinicPatients.department')}</th>
                        <th className="px-4 py-3 font-semibold hidden sm:table-cell">{t('clinicPatients.specialization')}</th>
                        <th className="px-4 py-3 font-semibold">{t('clinicPatients.availability')}</th>
                        <th className="px-4 py-3 font-semibold hidden lg:table-cell">{t('clinicPatients.clinics')}</th>
                        {isAdmin && <th className="px-4 py-3 font-semibold" />}
                      </tr>
                    </thead>
                    <tbody>
                      {clinicDoctors.map((doctor) => (
                        <tr key={doctor._id} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={doctor.userId?.name} />
                              <div className="font-semibold text-gray-900">{withDrPrefix(doctor.userId?.name)}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{departmentLabel(doctor.department, t)}</td>
                          <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{specializationLabel(doctor.specialization, t)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${doctor.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {doctor.isAvailable ? t('clinicPatients.available') : t('clinicPatients.unavailable')}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {doctorClinicsOf(doctor._id.toString()).map((clinic) => (
                                <span key={clinic._id}
                                  className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${clinic._id === selectedId ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                  {clinicDisplayName(clinic, t)}
                                </span>
                              ))}
                            </div>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <div className="relative inline-flex items-center">
                                  <ArrowRightLeft size={12} className="absolute left-2 text-blue-400 pointer-events-none" />
                                  <select value="" onChange={(e) => moveDoctor(doctor._id.toString(), e.target.value)}
                                    className="h-8 border border-blue-200 text-blue-700 rounded-lg pl-6 pr-2 text-[11px] font-semibold bg-white hover:bg-blue-50 outline-none cursor-pointer transition-colors">
                                    <option value="">{t('clinicPatients.moveTo')}</option>
                                    {clinics.filter((clinic) => clinic._id !== selectedId).map((clinic) => (
                                      <option key={clinic._id} value={clinic._id}>{clinicDisplayName(clinic, t)}</option>
                                    ))}
                                  </select>
                                </div>
                                <button type="button" onClick={() => removeDoctor(doctor._id.toString())}
                                  className="h-8 text-[11px] font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-2.5 transition-colors">
                                  {t('clinicPatients.removeBtn')}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ClinicPatients;
