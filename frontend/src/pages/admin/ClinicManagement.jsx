/**
 * ClinicManagement.jsx — admin page for clinics and day-schedules.
 *
 * Create/edit/deactivate clinics (name + government clinic-type dropdown
 * + assigned doctors), and manage ClinicSessions: schedule a doctor for
 * a clinic on a date (overlap-checked), edit times, or cancel a day.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clinicService, doctorService, clinicSessionService } from '../../api';
import { clinicDisplayName, clinicTypeKey, clinicTypeLabel } from '../../utils/clinicTypes';
import { departmentForClinicType, departmentKeyOf, specializationLabel } from '../../utils/departments';
import { withDrPrefix } from '../../utils/names';
import Toast from '../../components/Toast.jsx';

const emptyForm = { clinicName: '', departmentType: '', assignedDoctors: [], isActive: true };

const inputClass = 'w-full h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-gray-400';
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';

// Date → 'YYYY-MM-DD' (local time, no timezone shift).
const toDateStr = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Page component.
const ClinicManagement = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'si' ? 'si-LK' : 'en-US';

  const [clinics, setClinics] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [sessionForm, setSessionForm] = useState({ date: '', clinicId: '', doctorId: '', startTime: '08:00', endTime: '12:00' });
  const [editSession, setEditSession] = useState(null);
  const [showClinics, setShowClinics] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const days = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      return date;
    });
  }, []);

  // Fetch clinics, doctors and upcoming sessions in parallel.
  const load = async () => {
    const from = toDateStr(days[0]);
    const to = toDateStr(days[6]);
    const [clinics, doctors, sessions] = await Promise.all([
      clinicService.getAll(),
      doctorService.getAll(),
      clinicSessionService.getRange(from, to),
    ]);
    setClinics(clinics);
    setDoctors(doctors);
    setSessions(sessions);
  };

  useEffect(() => {
    setSessionForm((prev) => ({ ...prev, date: toDateStr(days[0]) }));
    load().catch((err) => setError(err.response?.data?.message || t('clinicMgmt.failedLoad')));
  }, []);

  // ── Session scheduling ───────────────────────────────────────────

  const activeClinics = useMemo(() => clinics.filter((clinic) => clinic.isActive), [clinics]);

  // Doctors eligible for a clinic: the department that staffs it
  // (e.g. Eye Clinic → Ophthalmology) PLUS anyone explicitly assigned to
  // the clinic (admin can assign cross-department doctors from Clinic
  // Patients → Doctors view). Custom types with no known department fall
  // back to the assigned list, then all.
  const doctorsForClinicId = (clinicId) => {
    const clinic = clinics.find((item) => item._id === clinicId);
    if (!clinic) return doctors;

    // Ids of the doctors assigned to the clinic being edited.
    const assignedIds = (clinic.assignedDoctors || []).map((doctor) => (doctor?._id || doctor).toString());
    const deptKey = departmentForClinicType(clinicTypeKey(clinic.departmentType) || clinicTypeKey(clinic.clinicName));

    if (deptKey) {
      return doctors.filter((doctor) =>
        departmentKeyOf(doctor.department) === deptKey || assignedIds.includes(doctor._id.toString()));
    }
    if (!assignedIds.length) return doctors;
    return doctors.filter((doctor) => assignedIds.includes(doctor._id.toString()));
  };

  const availableDoctors = useMemo(
    () => doctorsForClinicId(sessionForm.clinicId),
    [clinics, doctors, sessionForm.clinicId]
  );

  const sessionsByDay = useMemo(() => {
    const map = {};
    sessions.forEach((session) => {
      const key = toDateStr(new Date(session.date));
      if (!map[key]) map[key] = [];
      map[key].push(session);
    });
    return map;
  }, [sessions]);

  // When the session form's clinic changes, reset the doctor choice.
  const handleClinicChange = (e) => {
    setSessionForm((prev) => ({ ...prev, clinicId: e.target.value, doctorId: '' }));
  };

  // Schedule a doctor for a clinic day (server checks overlaps).
  const submitSession = async (event) => {
    event.preventDefault();
    setError(''); setMessage('');
    try {
      setSaving(true);
      await clinicSessionService.create(sessionForm);
      setMessage(t('clinicSchedule.added'));
      setSessionForm((prev) => ({ ...prev, clinicId: '', doctorId: '' }));
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t('clinicSchedule.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  // Load a session's values into the edit form.
  const startEditSession = (session) => {
    setError(''); setMessage('');
    setEditSession({
      id: session._id,
      clinicId: session.clinicId?._id || session.clinicId,
      doctorId: session.doctorId?._id || '',
      startTime: session.startTime,
      endTime: session.endTime,
    });
  };

  // Save the edited session times/doctor.
  const saveEditSession = async (event) => {
    event.preventDefault();
    setError(''); setMessage('');
    try {
      setSaving(true);
      await clinicSessionService.update(editSession.id, {
        doctorId: editSession.doctorId,
        startTime: editSession.startTime,
        endTime: editSession.endTime,
      });
      setMessage(t('clinicSchedule.updated'));
      setEditSession(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t('clinicSchedule.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  // Cancel (delete) a scheduled session after confirmation.
  const removeSession = async (id) => {
    if (!window.confirm(t('clinicSchedule.deleteConfirm'))) return;
    setError(''); setMessage('');
    try {
      await clinicSessionService.remove(id);
      setMessage(t('clinicSchedule.deleted'));
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t('clinicSchedule.failedSave'));
    }
  };

  // Session date → localised weekday + date label.
  const dayLabel = (date, index) => {
    if (index === 0) return t('clinicSchedule.today');
    if (index === 1) return t('clinicSchedule.tomorrow');
    return date.toLocaleDateString(locale, { weekday: 'long' });
  };

  // ── Clinic create / edit ─────────────────────────────────────────

  const reset = () => { setForm(emptyForm); setEditingId(null); };

  // Load a clinic into the clinic form for editing.
  const edit = (clinic) => {
    setEditingId(clinic._id);
    setShowClinics(true);
    setForm({
      clinicName: clinic.clinicName, departmentType: clinic.departmentType,
      assignedDoctors: clinic.assignedDoctors?.map((doctor) => doctor._id) || [], isActive: clinic.isActive,
    });
  };

  // Create or update the clinic (same form for both).
  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    const payload = {
      clinicName: form.clinicName, departmentType: form.departmentType,
      assignedDoctors: form.assignedDoctors, isActive: form.isActive,
    };
    try {
      if (editingId) {
        await clinicService.update(editingId, payload);
        setMessage(t('clinicMgmt.updated'));
      } else {
        await clinicService.create(payload);
        setMessage(t('clinicMgmt.created'));
      }
      reset(); await load();
    } catch (err) { setError(err.response?.data?.message || t('clinicMgmt.failedSave')); }
  };

  // Delete/deactivate the clinic after confirmation.
  const remove = async (id) => {
    if (!window.confirm(t('clinicMgmt.deleteConfirm'))) return;
    await clinicService.remove(id);
    await load();
  };

  // Tick/untick a doctor in the clinic's assigned list.
  const toggleDoctor = (doctorId) => {
    setForm((current) => ({
      ...current,
      assignedDoctors: current.assignedDoctors.includes(doctorId)
        ? current.assignedDoctors.filter((id) => id !== doctorId)
        : [...current.assignedDoctors, doctorId],
    }));
  };

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">{t('clinicMgmt.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('clinicSchedule.subtitle')}</p>
        </div>

        <Toast error={error} message={message} onClearError={() => setError('')} onClearMessage={() => setMessage('')} />

        {/* ── 1. Schedule: add session + next 7 days ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="text-base font-bold text-blue-900 mb-4">{t('clinicSchedule.addSession')}</div>
          <form onSubmit={submitSession} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div>
              <label className={labelClass} htmlFor="sessionDay">{t('clinicSchedule.day')}</label>
              <select id="sessionDay" className={inputClass} value={sessionForm.date}
                onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} required>
                {days.map((date, index) => (
                  <option key={toDateStr(date)} value={toDateStr(date)}>
                    {dayLabel(date, index)} — {date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="sessionClinic">{t('clinicSchedule.clinic')}</label>
              <select id="sessionClinic" className={inputClass} value={sessionForm.clinicId} onChange={handleClinicChange} required>
                <option value="">{t('clinicSchedule.selectClinic')}</option>
                {activeClinics.map((clinic) => (
                  <option key={clinic._id} value={clinic._id}>
                    {clinicDisplayName(clinic, t)} — {clinicTypeLabel(clinic.departmentType, t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className={labelClass} htmlFor="sessionDoctor">{t('clinicSchedule.doctor')}</label>
              <select id="sessionDoctor" className={inputClass} value={sessionForm.doctorId}
                onChange={(e) => setSessionForm({ ...sessionForm, doctorId: e.target.value })} required>
                <option value="">{t('clinicSchedule.selectDoctor')}</option>
                {availableDoctors.map((doctor) => (
                  <option key={doctor._id} value={doctor._id}>{withDrPrefix(doctor.userId?.name)}</option>
                ))}
              </select>
              {sessionForm.clinicId && availableDoctors.length === 0 && (
                <div className="text-[11px] text-red-500 mt-1">{t('clinicSchedule.noDeptDoctors')}</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass} htmlFor="sessionStart">{t('clinicSchedule.startTime')}</label>
                <input id="sessionStart" type="time" className={inputClass} value={sessionForm.startTime}
                  onChange={(e) => setSessionForm({ ...sessionForm, startTime: e.target.value })} required />
              </div>
              <div>
                <label className={labelClass} htmlFor="sessionEnd">{t('clinicSchedule.endTime')}</label>
                <input id="sessionEnd" type="time" className={inputClass} value={sessionForm.endTime}
                  onChange={(e) => setSessionForm({ ...sessionForm, endTime: e.target.value })} required />
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-60">
              {saving ? t('clinicSchedule.adding') : t('clinicSchedule.addBtn')}
            </button>
          </form>
        </div>

        {/* 7-day grid — one card per day (today highlighted amber),
            each session inside can be edited inline or deleted */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {days.map((date, index) => {
            const key = toDateStr(date);
            const daySessions = sessionsByDay[key] || [];
            return (
              <div key={key} className={`bg-white rounded-2xl shadow-sm border p-4 ${index === 0 ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-blue-900 text-sm">{dayLabel(date, index)}</div>
                    <div className="text-xs text-gray-400">{date.toLocaleDateString(locale, { month: 'long', day: 'numeric' })}</div>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                    {daySessions.length} {t('clinicSchedule.sessionsCount')}
                  </span>
                </div>
                {daySessions.length === 0 ? (
                  <div className="border-2 border-dashed border-blue-100 rounded-xl p-4 text-center text-gray-300 text-xs">
                    {t('clinicSchedule.noSessions')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {daySessions.map((session) => (
                      <div key={session._id} className="relative overflow-hidden rounded-xl border border-blue-100 bg-blue-50/70 p-3 pl-4">
                        <span className="absolute inset-y-0 left-0 w-1 bg-blue-500" aria-hidden="true" />
                        {/* This session is being edited → inline form; otherwise summary row */}
                        {editSession?.id === session._id ? (
                          <form onSubmit={saveEditSession} className="space-y-2">
                            <div className="font-semibold text-gray-900 text-xs truncate">{clinicDisplayName(session.clinicId, t)}</div>
                            <select className={`${inputClass} h-8 px-2 text-xs`} value={editSession.doctorId}
                              onChange={(e) => setEditSession({ ...editSession, doctorId: e.target.value })} required>
                              <option value="">{t('clinicSchedule.selectDoctor')}</option>
                              {doctorsForClinicId(editSession.clinicId).map((doctor) => (
                                <option key={doctor._id} value={doctor._id}>{withDrPrefix(doctor.userId?.name)}</option>
                              ))}
                            </select>
                            <div className="grid grid-cols-2 gap-2">
                              <input type="time" className={`${inputClass} h-8 px-2 text-xs`} value={editSession.startTime}
                                onChange={(e) => setEditSession({ ...editSession, startTime: e.target.value })} required />
                              <input type="time" className={`${inputClass} h-8 px-2 text-xs`} value={editSession.endTime}
                                onChange={(e) => setEditSession({ ...editSession, endTime: e.target.value })} required />
                            </div>
                            <div className="flex gap-2">
                              <button type="submit" disabled={saving}
                                className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg px-3 py-1 transition-colors disabled:opacity-60">
                                {t('common.save')}
                              </button>
                              <button type="button" onClick={() => setEditSession(null)}
                                className="text-[10px] border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg px-3 py-1 transition-colors">
                                {t('common.cancel')}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 text-xs truncate">{clinicDisplayName(session.clinicId, t)}</div>
                              <div className="text-[11px] font-medium text-blue-700">{clinicTypeLabel(session.clinicId?.departmentType, t)}</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                {withDrPrefix(session.doctorId?.userId?.name)} · {session.startTime} – {session.endTime}
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button type="button" onClick={() => startEditSession(session)}
                                className="text-[10px] border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg px-2 py-1 transition-colors">
                                {t('common.edit')}
                              </button>
                              <button type="button" onClick={() => removeSession(session._id)}
                                className="text-[10px] border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-2 py-1 transition-colors">
                                {t('common.delete')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── 2. Clinics: create/edit + list (bottom) ── */}
        <div className="mt-8 mb-4">
          <h2 className="text-lg font-bold text-blue-900">{t('clinicMgmt.clinics')}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{t('clinicMgmt.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5 items-start">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="text-base font-bold text-blue-900 mb-4">{editingId ? t('clinicMgmt.editClinic') : t('clinicMgmt.newClinic')}</div>
            <form onSubmit={submit}>
              <div className="mb-3">
                <label className={labelClass} htmlFor="clinicName">{t('clinicMgmt.clinicName')}</label>
                <input id="clinicName" className={inputClass} value={form.clinicName}
                  onChange={(e) => setForm({ ...form, clinicName: e.target.value })} required />
              </div>
              <div className="mb-3">
                <label className={labelClass} htmlFor="departmentType">{t('clinicMgmt.deptType')}</label>
                <input id="departmentType" className={inputClass} value={form.departmentType}
                  onChange={(e) => setForm({ ...form, departmentType: e.target.value })}
                  placeholder={t('clinicMgmt.customTypePlaceholder')} required />
              </div>
              <div className="mb-3">
                <label className={labelClass}>{t('clinicMgmt.assignedDoctors')}</label>
                <div className="border border-gray-200 rounded-xl p-3 max-h-44 overflow-y-auto bg-blue-50 space-y-1">
                  {doctors.map((doctor) => (
                    <label key={doctor._id} className="flex items-center gap-2 cursor-pointer py-1 hover:bg-white rounded-lg px-1 transition-colors">
                      <input type="checkbox" className="accent-blue-600"
                        checked={form.assignedDoctors.includes(doctor._id)} onChange={() => toggleDoctor(doctor._id)} />
                      <span className="text-sm text-gray-700">{withDrPrefix(doctor.userId?.name)} — {specializationLabel(doctor.specialization, t)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <input id="isActive" type="checkbox" className="accent-blue-600 w-4 h-4"
                  checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <label htmlFor="isActive" className="text-sm font-semibold text-gray-700">{t('clinicMgmt.activeClinic')}</label>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors" type="submit">
                  {editingId ? t('clinicMgmt.updateBtn') : t('clinicMgmt.createBtn')}
                </button>
                {editingId && (
                  <button type="button" onClick={reset}
                    className="px-4 h-10 bg-white border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-bold text-blue-900">{t('clinicMgmt.clinics')} ({clinics.length})</div>
              <button type="button" onClick={() => setShowClinics((current) => !current)}
                className="text-xs border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-1.5 font-semibold transition-colors">
                {showClinics ? t('clinicMgmt.hideClinics') : t('clinicMgmt.showClinics')}
              </button>
            </div>
            {!showClinics ? (
              <div className="border-2 border-dashed border-blue-100 rounded-xl p-6 text-center text-gray-400 text-xs">
                {t('clinicMgmt.listHiddenHint')}
              </div>
            ) : clinics.length === 0 ? (
              <div className="border-2 border-dashed border-blue-100 rounded-xl p-8 text-center text-gray-400 text-sm">{t('clinicMgmt.noClinics')}</div>
            ) : (
              <div className="space-y-3">
                {clinics.map((clinic) => (
                  <div key={clinic._id} className="flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-100 hover:bg-blue-50/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-gray-900 text-sm">{clinicDisplayName(clinic, t)}</span>
                        <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${clinic.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {clinic.isActive ? t('clinicMgmt.active') : t('clinicMgmt.inactive')}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{clinicTypeLabel(clinic.departmentType, t)}</div>
                      {clinic.assignedDoctors?.length ? (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          {clinic.assignedDoctors.map((doctor) => (
                            <span key={doctor._id} className="text-[10px] bg-blue-100 text-blue-700 font-semibold rounded-full px-2 py-0.5">
                              {withDrPrefix(doctor.userId?.name)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 mt-0.5">0 {t('clinicMgmt.doctorsAssigned')}</div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button type="button" onClick={() => edit(clinic)}
                        className="text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg px-3 py-1 transition-colors">{t('common.edit')}</button>
                      <button type="button" onClick={() => remove(clinic._id)}
                        className="text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-3 py-1 transition-colors">{t('common.delete')}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicManagement;
