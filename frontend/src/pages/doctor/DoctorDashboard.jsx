/**
 * DoctorDashboard.jsx — the doctor's home page.
 *
 * Left: their live queue for the selected clinic with a "Call Next"
 * button (advances only this doctor's patients). Right: patient search
 * with a history panel and history-PDF download. Queue updates arrive
 * live over the clinic's Socket.IO room.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PhoneCall, Download, X, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { doctorService, queueService, patientService } from '../../api';
import { clinicDisplayName } from '../../utils/clinicTypes';
import { departmentLabel, specializationLabel } from '../../utils/departments';
import { useSocket } from '../../context/SocketContext.jsx';
import Toast from '../../components/Toast.jsx';

// Chip showing how the appointment was made (online/walk-in).
const apptBadge = (type) => {
  if (!type) return null;
  const map = { 'walk-in': 'bg-red-100 text-red-700', online: 'bg-green-100 text-green-700', 'follow-up': 'bg-blue-100 text-blue-700' };
  const labels = { 'walk-in': 'Walk-in', online: 'Online', 'follow-up': 'Follow-up' };
  return <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${map[type] || 'bg-gray-100 text-gray-600'}`}>{labels[type] || type}</span>;
};

// 'Nimal Perera' → 'NP' for the avatar circle.
const initials = (name) => name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

// Page component.
const DoctorDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [calling, setCalling] = useState(false);
  const [doctor, setDoctor] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [clinicId, setClinicId] = useState('');
  const [queue, setQueue] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    doctorService.getMyProfile()
      .then((data) => { setDoctor(data.doctor); setClinics(data.clinics || []); setClinicId(data.clinics?.[0]?._id || ''); })
      .catch((err) => setError(err.response?.data?.message || t('common.error')));
  }, []);

  useEffect(() => {
    if (!clinicId || !doctor) { setQueue([]); return; }
    queueService.getLive(clinicId)
      .then((queue) => setQueue(queue.filter((item) => item.doctorId?._id === doctor._id)))
      .catch((err) => setError(err.response?.data?.message || t('common.error')));
  }, [clinicId, doctor?._id]);

  useEffect(() => {
    if (!socket || !clinicId || !doctor) return undefined;
    socket.emit('join-clinic', clinicId);
    // Live queue refresh from the socket (my patients only).
    const handleUpdate = (updatedQueue) => setQueue((updatedQueue || []).filter((item) => item.doctorId?._id === doctor._id));
    // Live doctor-availability updates from the socket.
    const handleStatus = (payload) => { if (payload.doctorId === doctor._id) setDoctor((d) => ({ ...d, isAvailable: payload.isAvailable })); };
    socket.on('queue:updated', handleUpdate);
    socket.on('doctor:status_changed', handleStatus);
    return () => { socket.emit('leave-clinic', clinicId); socket.off('queue:updated', handleUpdate); socket.off('doctor:status_changed', handleStatus); };
  }, [socket, clinicId, doctor?._id]);

  // Flip my availability and broadcast it.
  const toggleAvailability = async () => {
    setError(''); setMessage('');
    try {
      const data = await doctorService.updateAvailability(!doctor.isAvailable);
      setDoctor(data.doctor); setMessage(data.message);
    } catch (err) { setError(err.response?.data?.message || t('common.error')); }
  };

  // Load the selected patient's past records.
  const loadHistory = async (patient) => {
    setSelectedPatient(patient); setRecords([]); setHistoryLoading(true);
    try { const data = await patientService.getHistory(patient._id); setRecords(data.records || []); }
    catch (err) { setError(err.response?.data?.message || t('common.error')); }
    finally { setHistoryLoading(false); }
  };

  // Download the selected patient's history PDF.
  const downloadHistory = async () => {
    if (!selectedPatient) return;
    setPdfLoading(true);
    try { await doctorService.downloadHistoryPdf(selectedPatient._id, selectedPatient.userId?.name); }
    catch { setError(t('doctorDashboard.pdfFailed')); }
    finally { setPdfLoading(false); }
  };

  // Search patients by name / NIC / phone.
  const searchPatients = async (event) => {
    event.preventDefault(); setError('');
    if (searchTerm.trim().length < 2) { setError(t('common.error')); return; }
    try {
      const results = await patientService.search(searchTerm.trim());
      setSearchResults(results);
    } catch (err) { setError(err.response?.data?.message || t('common.error')); }
  };

  // Doctor drives the queue: completes the current patient and calls the next one
  const callNext = async () => {
    setError(''); setMessage(''); setCalling(true);
    try {
      const data = await queueService.callNext(clinicId);
      if (data.queue && doctor) setQueue(data.queue.filter((item) => item.doctorId?._id === doctor._id));
      setMessage(data.current
        ? `${t('doctorDashboard.nowCalling')} #${data.current.queueNumber} — ${data.current.patientId?.userId?.name || ''}`
        : t('doctorDashboard.queueEmpty'));
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally { setCalling(false); }
  };

  // Jump to the consultation form with this patient preselected.
  const openConsultation = (patient) => {
    if (patient?._id) navigate(`/doctor/consultation?patientId=${patient._id}&clinicId=${clinicId}`);
  };

  const current = queue.find((item) => item.status === 'serving');
  const waiting = queue.filter((item) => item.status === 'waiting');

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">{t('doctorDashboard.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{doctor ? `${specializationLabel(doctor.specialization, t)} — ${departmentLabel(doctor.department, t)}` : t('doctorDashboard.subtitle')}</p>
          </div>
          {/* Header actions: availability toggle, consultation page link, Call Next */}
          <div className="flex gap-3">
            <button type="button" onClick={toggleAvailability} disabled={!doctor}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${doctor?.isAvailable ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
              {doctor?.isAvailable ? t('doctorDashboard.available') : t('doctorDashboard.unavailable')}
            </button>
            <Link to="/doctor/consultation" style={{ textDecoration: 'none' }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors">
              {t('doctorDashboard.consultation')}
            </Link>
            <button type="button" onClick={callNext} disabled={!clinicId || calling || !doctor?.isAvailable}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 text-blue-900 rounded-xl px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <PhoneCall size={15} /> {calling ? t('doctorDashboard.calling') : t('doctorDashboard.callNext')}
            </button>
          </div>
        </div>

        <Toast error={error} message={message} onClearError={() => setError('')} onClearMessage={() => setMessage('')} />
        {!doctor?.isAvailable && <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-800 rounded-xl p-3 text-sm mb-4">{t('doctorDashboard.queuePaused')}</div>}

        {/* Live queue table for the selected clinic (click a row → consultation) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="flex justify-between items-center mb-4">
            <span className="text-base font-bold text-blue-900">{t('doctorDashboard.trackAppointment')}</span>
            <div className="flex items-center gap-3">
              <select className="h-8 border border-gray-200 rounded-xl px-3 text-xs bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500"
                value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
                {clinics.length === 0 && <option value="">{t('doctorDashboard.notAssigned')}</option>}
                {clinics.map((c) => <option key={c._id} value={c._id}>{clinicDisplayName(c, t)}</option>)}
              </select>
              <Link to="/doctor/queue" style={{ textDecoration: 'none' }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">{t('doctorDashboard.viewAll')}</Link>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50">
                  {[t('doctorDashboard.queueNo'), t('doctorDashboard.patient'), t('doctorDashboard.type'), t('doctorDashboard.wait'), t('common.status'), ''].map((h) => (
                    <th key={h} className="text-left text-xs font-bold uppercase tracking-wide text-blue-900 px-4 py-3 border-b-2 border-blue-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-8 text-sm">{t('doctorDashboard.noQueue')}</td></tr>
                ) : queue.slice(0, 8).map((item) => (
                  <tr key={item._id} onClick={() => openConsultation(item.patientId)}
                    title={t('doctorDashboard.openConsultation')}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-bold text-blue-900">#{item.queueNumber}</td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">{item.patientId?.userId?.name || '—'}</td>
                    <td className="px-4 py-3">{apptBadge(item.appointmentId?.bookingType)}</td>
                    <td className="px-4 py-3 text-gray-500">{item.estimatedWaitTime ?? 0} {t('queueStatus.min')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 ${item.status === 'serving' ? 'bg-green-100 text-green-700' : item.status === 'waiting' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={(e) => { e.stopPropagation(); loadHistory(item.patientId); }}
                        className="text-xs border border-gray-200 rounded-lg px-3 py-1 hover:bg-blue-50 text-gray-600 transition-colors">
                        {t('doctorDashboard.history')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Waiting-queue list (left) + big "Now Serving" token card (right) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
          <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="text-base font-bold text-blue-900 mb-4">{t('doctorDashboard.waitingQueue')} ({waiting.length})</div>
            {waiting.length === 0 ? (
              <div className="border-2 border-dashed border-blue-100 rounded-xl p-8 text-center text-gray-400 text-sm">{t('doctorDashboard.noWaiting')}</div>
            ) : (
              <div className="space-y-2">
                {waiting.map((item) => (
                  <button type="button" key={item._id} onClick={() => openConsultation(item.patientId)}
                    title={t('doctorDashboard.openConsultation')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors text-left cursor-pointer">
                    <div className="w-8 h-8 rounded-xl bg-amber-400 text-blue-900 flex items-center justify-center text-xs font-bold flex-shrink-0">{item.queueNumber}</div>
                    <span className="text-sm text-gray-800 flex-1 font-semibold">{item.patientId?.userId?.name || t('doctorDashboard.patient')}</span>
                    {apptBadge(item.appointmentId?.bookingType)}
                    <span className="text-xs text-gray-400">{item.estimatedWaitTime ?? 0} {t('queueStatus.min')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="bg-blue-900 rounded-2xl p-4 mb-4 text-center">
              <div className="text-xs text-blue-300 font-semibold uppercase tracking-wider mb-1">{t('doctorDashboard.nowServing')}</div>
              <div className="text-5xl font-bold text-amber-400 leading-none">{current ? `#${current.queueNumber}` : '—'}</div>
            </div>
            {current ? (
              <>
                <button type="button" onClick={() => openConsultation(current.patientId)}
                  title={t('doctorDashboard.openConsultation')}
                  className="w-full flex items-center gap-3 p-2 -m-2 rounded-xl hover:bg-blue-50 transition-colors text-left cursor-pointer">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center text-base font-bold flex-shrink-0">{initials(current.patientId?.userId?.name)}</div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{current.patientId?.userId?.name || t('doctorDashboard.patient')}</div>
                    <div className="text-xs text-gray-500">{current.patientId?.NIC || '—'}</div>
                  </div>
                </button>
                <button type="button" onClick={() => openConsultation(current.patientId)}
                  className="mt-4 w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors">
                  {t('doctorDashboard.startConsultation')}
                </button>
              </>
            ) : <div className="text-sm text-gray-400 text-center">{t('doctorDashboard.noServing')}</div>}
          </div>
        </div>

        {/* Patient history search — find any patient and open their records */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="text-base font-bold text-blue-900 mb-4">{t('doctorDashboard.searchHistory')}</div>
          <form className="flex gap-3 mb-4" onSubmit={searchPatients}>
            <input className="flex-1 h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder={t('doctorDashboard.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <button type="submit" className="px-5 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors">{t('doctorDashboard.search')}</button>
          </form>
          {searchResults.map((patient) => (
            <button key={patient._id} type="button" onClick={() => loadHistory(patient)}
              className="w-full flex justify-between items-center p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 text-left transition-colors mb-2">
              <span className="text-sm font-semibold text-gray-900">{patient.userId?.name}</span>
              <span className="text-xs text-gray-500">{patient.NIC} | {patient.userId?.phone}</span>
            </button>
          ))}
        </div>

        {/* Patient history modal (opened by the History buttons) */}
        {selectedPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setSelectedPatient(null)}>
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-2xl p-6 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <ClipboardList size={19} />
                  </div>
                  <div>
                    <div className="text-base font-bold text-blue-900">{t('doctorDashboard.historyOf')} {selectedPatient.userId?.name}</div>
                    <div className="text-xs text-gray-500">{selectedPatient.NIC || '—'} · {records.length} {t('doctorDashboard.visits')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={downloadHistory} disabled={pdfLoading || records.length === 0}
                    title={t('doctorDashboard.downloadHistoryPdf')}
                    className="h-9 px-3 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs transition-colors disabled:opacity-50">
                    <Download size={14} /> {pdfLoading ? t('consultation.generating') : 'PDF'}
                  </button>
                  <button type="button" onClick={() => setSelectedPatient(null)} title={t('common.close')}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto pr-1">
                {historyLoading ? (
                  <div className="text-center text-gray-400 py-10 text-sm">{t('common.loading')}</div>
                ) : records.length ? records.map((record) => (
                  <div key={record._id} className="border-b border-gray-50 py-4 last:border-0">
                    <div className="flex justify-between gap-4 mb-1">
                      <span className="text-sm font-bold text-gray-900">{record.diagnosis}</span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(record.visitDate).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="text-xs text-gray-600"><span className="font-semibold">{t('doctorDashboard.symptoms')}</span> {record.symptoms}</div>
                    {record.prescription?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {record.prescription.map((p, i) => (
                          <span key={`${p.medicine}-${i}`} className="bg-blue-50 text-blue-700 rounded-full px-2.5 py-0.5 text-[10px] font-medium">{p.medicine} · {p.dosage}</span>
                        ))}
                      </div>
                    )}
                    {record.treatmentNotes && (
                      <div className="text-xs text-gray-500 mt-1.5">{record.treatmentNotes}</div>
                    )}
                  </div>
                )) : <div className="border-2 border-dashed border-blue-100 rounded-xl p-8 text-center text-gray-400 text-sm">{t('doctorDashboard.noRecords')}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorDashboard;
