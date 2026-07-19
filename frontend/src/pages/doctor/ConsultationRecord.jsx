/**
 * ConsultationRecord.jsx — the doctor's consultation form.
 *
 * Pick a patient (or arrive pre-selected from the queue via ?patientId=),
 * see their vitals/BMI and past history, then record symptoms, diagnosis,
 * prescription lines (medicine/dosage/duration dropdowns), notes and
 * follow-up. Saving tags the record with the current clinic (clinicId).
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Droplets, Weight, Ruler, Activity, Calendar, ClipboardList, CheckCircle2, PhoneCall, FileText, ImageIcon, ExternalLink, Download } from 'lucide-react';
import { patientService, doctorService, queueService, medicalReportService, clinicService } from '../../api';
import { computeBmi } from '../../utils/health.js';
import { clinicTypeKey, clinicDisplayName } from '../../utils/clinicTypes.js';
import { medicineOptions, DOSAGE_OPTIONS, durationOptions } from '../../utils/prescriptions.js';
import PatientSearchInput from '../../components/PatientSearchInput.jsx';
import Toast from '../../components/Toast.jsx';

const emptyPrescription = { medicine: '', dosage: '', duration: '' };
const emptyForm = { patientId: '', symptoms: '', diagnosis: '', notes: '', followUpInstructions: '', followUpDate: '', tags: '' };

const inputClass = 'w-full h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-gray-400';
const textareaClass = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-gray-400 resize-y';

// Small section heading used inside the form.
const SectionLabel = ({ children }) => (
  <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-100 mt-5 mb-3">{children}</div>
);

// One vitals tile (BMI, blood group, …).
const Stat = ({ icon: Icon, label, value, sub }) => (
  <div className="rounded-xl bg-blue-50 px-3 py-2.5">
    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
      <Icon size={11} /> {label}
    </div>
    <div className="text-sm text-gray-900 font-bold mt-0.5">{value || '—'}</div>
    {sub && <div className="text-[10px] text-gray-500 font-medium">{sub}</div>}
  </div>
);

// Page component.
const ConsultationRecord = () => {
  const { t } = useTranslation();
  const labelClass = `block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide`;
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [prescriptions, setPrescriptions] = useState([{ ...emptyPrescription }]);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedRecordId, setSavedRecordId] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [clinicId, setClinicId] = useState('');
  const [myClinics, setMyClinics] = useState([]);
  const [allClinics, setAllClinics] = useState([]);
  const [reports, setReports] = useState([]);
  const [historyPdfLoading, setHistoryPdfLoading] = useState(false);
  const [callingNext, setCallingNext] = useState(false);
  const [queueDone, setQueueDone] = useState(false);

  const selectedPatient = patients.find((p) => p._id === form.patientId) || null;
  const bmi = selectedPatient ? computeBmi(selectedPatient.weight, selectedPatient.height) : null;

  // Medicine suggestions follow the clinic's speciality (diabetic/cardiology/eye…)
  const activeClinicType = clinicTypeKey(
    myClinics.find((c) => c._id === clinicId)?.departmentType || myClinics[0]?.departmentType
  );
  const medicineList = medicineOptions(activeClinicType);

  // Arriving from the queue (?patientId=...&clinicId=...) — auto-select that patient
  useEffect(() => {
    const preselectId = searchParams.get('patientId');
    if (!preselectId) return;
    patientService.getById(preselectId)
      .then((data) => {
        const patient = data.patient || data;
        if (!patient?._id) return;
        setPatients([patient]);
        setForm((f) => ({ ...f, patientId: patient._id }));
      })
      .catch((err) => setError(err.response?.data?.message || t('common.error')));
  }, [searchParams]);

  // Clinic for "Done — Call Next": from the URL, else the doctor's first clinic.
  // Clinics are always loaded so medicine suggestions can follow the speciality.
  useEffect(() => {
    const paramClinic = searchParams.get('clinicId');
    doctorService.getMyProfile()
      .then((data) => {
        setMyClinics(data.clinics || []);
        setClinicId(paramClinic || data.clinics?.[0]?._id || '');
      })
      .catch(() => { if (paramClinic) setClinicId(paramClinic); });
  }, [searchParams]);

  // All active clinics — used to offer "+ add to clinic" for the patient
  useEffect(() => {
    clinicService.getActive().then(setAllClinics).catch(() => setAllClinics([]));
  }, []);

  // Register the selected patient to one more clinic (e.g. OPD doctor finds
  // a new condition and moves the patient into the right clinic on the spot)
  const assignToClinic = async (newClinicId) => {
    if (!selectedPatient || !newClinicId) return;
    setError(''); setMessage('');
    try {
      const data = await patientService.addToClinic(selectedPatient._id, newClinicId);
      setPatients((prev) => prev.map((p) => (p._id === data.patient._id ? data.patient : p)));
      setMessage(t('consultation.addedToClinic'));
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    }
  };

  // Done: completes the current (serving) patient's token and calls the next
  // one — the page then loads the next patient so consultations flow non-stop.
  const doneAndCallNext = async () => {
    setError(''); setCallingNext(true);
    try {
      const data = await queueService.callNext(clinicId);
      const next = data.current;
      if (next?.patientId?._id) {
        setPatients([next.patientId]);
        setForm({ ...emptyForm, patientId: next.patientId._id });
        setPrescriptions([{ ...emptyPrescription }]);
        setSavedRecordId(null);
        setQueueDone(false);
        setMessage(`${t('consultation.nowCalling')} #${next.queueNumber} — ${next.patientId?.userId?.name || ''}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setQueueDone(true);
        setMessage(t('consultation.queueFinished'));
      }
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally { setCallingNext(false); }
  };

  // Load the selected patient's past records + lab reports so the doctor
  // can review the full history (records, blood/ECG/x-ray reports, etc.)
  useEffect(() => {
    if (!form.patientId) { setHistory([]); setReports([]); return; }
    patientService.getHistory(form.patientId)
      .then((data) => setHistory(data.records || []))
      .catch(() => setHistory([]));
    medicalReportService.getByPatient(form.patientId)
      .then(setReports)
      .catch(() => setReports([]));
  }, [form.patientId]);

  // Download the patient's full history PDF.
  const downloadFullHistory = async () => {
    if (!selectedPatient) return;
    setHistoryPdfLoading(true);
    try { await doctorService.downloadHistoryPdf(selectedPatient._id, selectedPatient.userId?.name); }
    catch { setError(t('consultation.failedPdf')); }
    finally { setHistoryPdfLoading(false); }
  };

  // Update one form field.
  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  // Update one cell of a prescription row.
  const handlePrescriptionChange = (index, field, value) => {
    setPrescriptions((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };
  // Add an empty prescription line.
  const addPrescriptionRow = () => setPrescriptions((current) => [...current, { ...emptyPrescription }]);
  // Remove a prescription line.
  const removePrescriptionRow = (index) => { if (prescriptions.length === 1) return; setPrescriptions((current) => current.filter((_, i) => i !== index)); };

  // Validate + save the consultation record.
  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    const prescription = prescriptions.filter((item) => item.medicine.trim()).map((item) => ({
      medicine: item.medicine.trim(), dosage: item.dosage.trim() || 'As directed', duration: item.duration.trim() || 'As directed',
    }));
    const tags = form.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    try {
      setLoading(true);
      const result = await doctorService.addRecord({
        patientId: form.patientId, clinicId: clinicId || undefined,
        symptoms: form.symptoms, diagnosis: form.diagnosis, prescription,
        notes: form.notes, treatmentNotes: form.notes, followUpInstructions: form.followUpInstructions,
        followUpDate: form.followUpDate || undefined, tags,
      });
      setSavedRecordId(result.record?._id || null);
      setMessage(t('consultation.saved'));
      setForm({ ...emptyForm, patientId: form.patientId });
      setPrescriptions([{ ...emptyPrescription }]);
    } catch (err) {
      const validationMessage = err.response?.data?.errors?.map((item) => item.message).join(', ');
      setError(validationMessage || err.response?.data?.message || t('common.error'));
    } finally { setLoading(false); }
  };

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">{t('consultation.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('consultation.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-5 items-start">
          {/* Patient search sidebar */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 xl:sticky xl:top-20">
            <div className="text-sm font-bold text-blue-900 mb-3">{t('consultation.findPatient')}</div>
            <Toast error={error} onClearError={() => setError('')} />
            {message && (
              <div className="bg-green-50 border-l-4 border-green-500 text-green-700 rounded-xl p-2.5 text-xs mb-3">
                {message}
                {savedRecordId && (
                  <button
                    type="button"
                    disabled={pdfLoading}
                    onClick={async () => {
                      setPdfLoading(true);
                      try { await doctorService.downloadPrescriptionPdf(savedRecordId); }
                      catch { setError(t('consultation.failedPdf')); }
                      finally { setPdfLoading(false); }
                    }}
                    className="mt-2 w-full h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition-colors disabled:opacity-60 flex items-center justify-center gap-1"
                  >
                    {pdfLoading ? t('consultation.generating') : t('consultation.downloadPdf')}
                  </button>
                )}
                {savedRecordId && clinicId && !queueDone && (
                  <button
                    type="button"
                    disabled={callingNext}
                    onClick={doneAndCallNext}
                    className="mt-2 w-full h-9 bg-amber-400 hover:bg-amber-500 text-blue-900 font-bold rounded-lg text-xs transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    {callingNext
                      ? <>{t('consultation.callingNext')}</>
                      : <><CheckCircle2 size={13} /> {t('consultation.doneCallNext')}</>}
                  </button>
                )}
              </div>
            )}
            <div className="mb-3">
              <PatientSearchInput
                placeholder={t('consultation.searchPlaceholder')}
                onSelect={(patient) => {
                  setPatients((prev) => [patient, ...prev.filter((x) => x._id !== patient._id)]);
                  setForm((f) => ({ ...f, patientId: patient._id }));
                }}
              />
            </div>
            {patients.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">{t('consultation.noPatients')}</div>
            ) : patients.map((patient) => (
              <button key={patient._id} type="button"
                onClick={() => setForm((f) => ({ ...f, patientId: patient._id }))}
                className={`w-full text-left p-3 rounded-xl mb-2 border transition-colors ${
                  form.patientId === patient._id ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:bg-blue-50'
                }`}>
                <div className="text-sm font-semibold text-gray-900">{patient.userId?.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{patient.NIC} · {patient.userId?.phone}</div>
              </button>
            ))}
          </div>

          {/* Consultation form + patient vitals */}
          <div className="flex flex-col gap-5">
          {selectedPatient && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-bold text-blue-900 flex-wrap">
                  <User size={15} /> {selectedPatient.userId?.name}
                  <span className="text-xs font-normal text-gray-400">· {selectedPatient.NIC}</span>
                  {(selectedPatient.registeredClinics || []).map((clinic) => (
                    <span key={clinic?._id || clinic} className="text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                      {clinicDisplayName(clinic, t)}
                    </span>
                  ))}
                  {(() => {
                    // Clinic ids the selected patient is registered in.
                    const registeredIds = (selectedPatient.registeredClinics || []).map((c) => c?._id || c);
                    // General OPD is open to every patient, so "registering" to it
                    // is meaningless — offer only speciality clinics here.
                    const isOpd = (c) => clinicTypeKey(c.departmentType) === 'opd' || clinicTypeKey(c.clinicName) === 'opd';
                    const available = allClinics.filter((c) => !registeredIds.includes(c._id) && !isOpd(c));
                    if (available.length === 0) return null;
                    return (
                      <select value="" onChange={(e) => assignToClinic(e.target.value)}
                        title={t('consultation.addToClinic')}
                        className="text-[10px] font-bold text-blue-700 border border-dashed border-blue-300 rounded-full pl-2 pr-1 py-0.5 bg-white hover:bg-blue-50 cursor-pointer outline-none">
                        <option value="">+ {t('consultation.addToClinic')}</option>
                        {available.map((c) => (
                          <option key={c._id} value={c._id}>{clinicDisplayName(c, t)}</option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
                <button type="button" onClick={downloadFullHistory} disabled={historyPdfLoading}
                  className="flex items-center gap-1.5 h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60">
                  <Download size={13} />
                  {historyPdfLoading ? t('consultation.generating') : t('consultation.fullHistoryPdf')}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Stat icon={Calendar} label={t('profile.age')} value={selectedPatient.age} />
                <Stat icon={User} label={t('profile.gender')} value={selectedPatient.gender && selectedPatient.gender !== 'not-specified' ? t(`profile.${selectedPatient.gender}`) : null} />
                <Stat icon={Droplets} label={t('profile.bloodGroup')} value={selectedPatient.bloodGroup} />
                <Stat icon={Weight} label={t('profile.weight')} value={selectedPatient.weight ? `${selectedPatient.weight} kg` : null} />
                <Stat icon={Ruler} label={t('profile.height')} value={selectedPatient.height ? `${selectedPatient.height} cm` : null} />
                <Stat icon={Activity} label={t('profile.bmi')} value={bmi ? `${bmi.value}` : null} sub={bmi?.label} />
              </div>

              {history.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-100 mb-3">
                    <ClipboardList size={12} /> {t('consultation.pastVisits')} ({history.length})
                  </div>
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {history.map((record) => (
                      <div key={record._id} className="bg-blue-50 rounded-xl p-3">
                        <div className="flex justify-between gap-3 mb-0.5">
                          <span className="text-xs font-bold text-gray-900">{record.diagnosis}</span>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">{new Date(record.visitDate).toLocaleDateString('en-GB')}</span>
                        </div>
                        <span className="inline-block text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 mb-1">
                          {record.clinicId ? clinicDisplayName(record.clinicId, t) : t('clinicTypes.opd')}
                        </span>
                        <div className="text-[11px] text-gray-600">{record.symptoms}</div>
                        {record.prescription?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {record.prescription.map((p, i) => (
                              <span key={`${p.medicine}-${i}`} className="bg-white text-blue-700 rounded-full px-2 py-0.5 text-[10px] font-medium">{p.medicine}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lab / medical reports uploaded for this patient */}
              <div className="mt-5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest pb-2 border-b border-gray-100 mb-3">
                  <FileText size={12} /> {t('consultation.labReports')} ({reports.length})
                </div>
                {reports.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2">{t('patientReports.noReports')}</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {reports.map((report) => (
                      <a key={report._id} href={report.fileUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2.5 border border-gray-100 rounded-xl px-3 py-2 hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${report.fileType === 'pdf' ? 'bg-red-50' : 'bg-blue-50'}`}>
                          {report.fileType === 'pdf'
                            ? <FileText size={14} className="text-red-500" />
                            : <ImageIcon size={14} className="text-blue-500" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-gray-900 truncate">{report.title}</div>
                          <div className="text-[10px] text-gray-400">
                            {report.reportType} · {new Date(report.reportDate).toLocaleDateString('en-GB')}
                          </div>
                        </div>
                        <ExternalLink size={12} className="text-gray-300 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* The consultation form itself: patient/clinic pick, clinical
              notes, prescription rows, then Save (+ Done & Call Next) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <form onSubmit={submit}>
              <SectionLabel>{t('consultation.patientScheduling')}</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="patientId">{t('consultation.patient')}</label>
                  <select id="patientId" name="patientId" className={inputClass} value={form.patientId} onChange={handleChange} required>
                    <option value="">{t('consultation.selectPatient')}</option>
                    {patients.map((patient) => (
                      <option key={patient._id} value={patient._id}>{patient.userId?.name} — {patient.NIC} — {patient.userId?.phone}</option>
                    ))}
                  </select>
                </div>
                {myClinics.length > 0 && (
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="clinicId">{t('consultation.clinic')}</label>
                    <select id="clinicId" className={inputClass} value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
                      {myClinics.map((clinic) => (
                        <option key={clinic._id} value={clinic._id}>{clinicDisplayName(clinic, t)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className={labelClass} htmlFor="followUpDate">{t('consultation.followUpDate')}</label>
                  <input id="followUpDate" name="followUpDate" type="date" className={inputClass} value={form.followUpDate} onChange={handleChange} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="tags">{t('consultation.tags')}</label>
                  <input id="tags" name="tags" className={inputClass} placeholder={t('consultation.tagsPlaceholder')} value={form.tags} onChange={handleChange} />
                </div>
              </div>

              <SectionLabel>{t('consultation.clinicalNotes')}</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="symptoms">{t('consultation.symptoms')}</label>
                  <textarea id="symptoms" name="symptoms" className={textareaClass} rows="4" value={form.symptoms} onChange={handleChange} required />
                </div>
                <div>
                  <label className={labelClass} htmlFor="diagnosis">{t('consultation.diagnosis')}</label>
                  <textarea id="diagnosis" name="diagnosis" className={textareaClass} rows="4" value={form.diagnosis} onChange={handleChange} required />
                </div>
                <div>
                  <label className={labelClass} htmlFor="notes">{t('consultation.notes')}</label>
                  <textarea id="notes" name="notes" className={textareaClass} rows="3" value={form.notes} onChange={handleChange} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="followUpInstructions">{t('consultation.followUp')}</label>
                  <textarea id="followUpInstructions" name="followUpInstructions" className={textareaClass} rows="3" value={form.followUpInstructions} onChange={handleChange} />
                </div>
              </div>

              <SectionLabel>{t('consultation.prescription')}</SectionLabel>
              {/* Suggestion lists: type to filter, pick from the dropdown, or
                  keep typing to enter a medicine/dose that isn't listed. */}
              <datalist id="rx-medicines">
                {medicineList.map((med) => <option key={med} value={med} />)}
              </datalist>
              <datalist id="rx-dosages">
                {DOSAGE_OPTIONS.map((d) => <option key={d} value={d} />)}
              </datalist>
              <datalist id="rx-durations">
                {durationOptions().map((d) => <option key={d} value={d} />)}
              </datalist>
              {/* One row per medicine: name / dosage / duration / remove */}
              {prescriptions.map((item, index) => (
                <div key={`prescription-${index}`} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_2fr_auto] gap-2 mb-2">
                  <input className={inputClass} list="rx-medicines" placeholder={t('consultation.medicine')} value={item.medicine} onChange={(e) => handlePrescriptionChange(index, 'medicine', e.target.value)} />
                  <input className={inputClass} list="rx-dosages" placeholder={t('consultation.dosage')} value={item.dosage} onChange={(e) => handlePrescriptionChange(index, 'dosage', e.target.value)} />
                  <input className={inputClass} list="rx-durations" placeholder={t('consultation.duration')} value={item.duration} onChange={(e) => handlePrescriptionChange(index, 'duration', e.target.value)} />
                  <button type="button" onClick={() => removePrescriptionRow(index)}
                    className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center text-lg hover:bg-red-100 transition-colors">
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={addPrescriptionRow}
                className="text-xs text-blue-600 border border-blue-200 bg-white hover:bg-blue-50 rounded-xl px-3 py-1.5 mb-5 transition-colors">
                {t('consultation.addMedicine')}
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <button className="h-11 px-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-60"
                  type="submit" disabled={loading}>
                  {loading ? t('consultation.saving') : t('consultation.save')}
                </button>
                {savedRecordId && clinicId && !queueDone && (
                  <button type="button" onClick={doneAndCallNext} disabled={callingNext}
                    className="h-11 px-8 bg-amber-400 hover:bg-amber-500 text-blue-900 font-bold rounded-xl text-sm transition-colors disabled:opacity-60 flex items-center gap-2">
                    {callingNext
                      ? t('consultation.callingNext')
                      : <><PhoneCall size={15} /> {t('consultation.doneCallNext')}</>}
                  </button>
                )}
                {queueDone && (
                  <span className="text-sm font-semibold text-green-700 bg-green-50 rounded-xl px-4 py-2.5">
                    ✓ {t('consultation.queueFinished')}
                  </span>
                )}
              </div>
            </form>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsultationRecord;
