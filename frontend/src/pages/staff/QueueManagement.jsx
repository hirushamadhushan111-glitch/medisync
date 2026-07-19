/**
 * QueueManagement.jsx — staff's live queue monitor (read-only).
 * Watches the selected clinic's queue in real time; patients are called
 * by the DOCTOR, so staff only observe here. Also shows a banner when a
 * doctor toggles their availability.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { queueService } from '../../api';
import { clinicDisplayName } from '../../utils/clinicTypes';
import { withDrPrefix } from '../../utils/names';
import QueueDisplay from '../../components/QueueDisplay.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useClinic } from '../../context/ClinicContext.jsx';
import Toast from '../../components/Toast.jsx';

// Page component.
const QueueManagement = () => {
  const { t } = useTranslation();
  const { socket } = useSocket();
  // Clinic selection is shared app-wide: the navbar selector and this page's
  // dropdown both drive the same active clinic from ClinicContext.
  const { clinics, activeClinic, setActiveClinic } = useClinic();
  const clinicId = activeClinic?._id || '';
  const [queue, setQueue] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [doctorStatus, setDoctorStatus] = useState('');

  // Fetch the selected clinic's live queue.
  const loadQueue = async () => {
    if (!clinicId) return;
    const queue = await queueService.getLive(clinicId);
    setQueue(queue);
  };

  useEffect(() => {
    loadQueue().catch((err) => setError(err.response?.data?.message || t('common.error')));
  }, [clinicId]);

  useEffect(() => {
    if (!socket || !clinicId) return undefined;
    socket.emit('join-clinic', clinicId);
    // Live refresh from the clinic's socket room.
    const handleUpdate = (updatedQueue) => setQueue(updatedQueue);
    // Banner when a doctor of this clinic toggles availability.
    const handleDoctorStatus = (payload) => {
      if (payload.clinicIds?.includes(clinicId)) {
        setDoctorStatus(`${withDrPrefix(payload.doctorName) || t('queueMgmt.doctor')} is now ${payload.isAvailable ? t('doctorProfile.available') : t('doctorProfile.unavailable')}.`);
      }
    };
    socket.on('queue:updated', handleUpdate);
    socket.on('doctor:status_changed', handleDoctorStatus);
    return () => {
      socket.emit('leave-clinic', clinicId);
      socket.off('queue:updated', handleUpdate);
      socket.off('doctor:status_changed', handleDoctorStatus);
    };
  }, [socket, clinicId]);

  const waiting = queue.filter((item) => item.status === 'waiting').length;
  const serving = queue.find((item) => item.status === 'serving');

  // Counts for the side summary card, split by token status.
  const summaryCounts = [
    { label: t('queueMgmt.waiting'),   count: waiting,                                              color: 'text-blue-900' },
    { label: t('queueMgmt.serving'),   count: queue.filter((q) => q.status === 'serving').length,   color: 'text-green-600' },
    { label: t('queueMgmt.completed'), count: queue.filter((q) => q.status === 'completed').length, color: 'text-gray-500' },
    { label: t('queueMgmt.skipped'),   count: queue.filter((q) => q.status === 'skipped').length,   color: 'text-red-500' },
  ];

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">{t('queueMgmt.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('queueMgmt.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <select className="h-10 border border-gray-200 rounded-xl px-3 text-sm bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500"
              value={clinicId} onChange={(event) => setActiveClinic(clinics.find((c) => c._id === event.target.value))}>
              {clinics.map((clinic) => (
                <option key={clinic._id} value={clinic._id}>{clinicDisplayName(clinic, t)}</option>
              ))}
            </select>
          </div>
        </div>

        <Toast error={error} message={message} onClearError={() => setError('')} onClearMessage={() => setMessage('')} />
        {doctorStatus && <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 rounded-xl p-3 text-sm mb-4">{doctorStatus}</div>}

        {/* Left: live token list. Right: now-serving card + status summary. */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5 items-start">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex justify-between items-center mb-4">
              <span className="text-base font-bold text-blue-900">{t('queueMgmt.liveQueue')} ({queue.length})</span>
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> {t('queueMgmt.live')}
              </span>
            </div>
            <QueueDisplay queue={queue} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="bg-blue-900 rounded-2xl p-4 mb-4 text-center">
                <div className="text-xs text-blue-300 font-semibold uppercase tracking-wider mb-1">{t('queueMgmt.nowServing')}</div>
                <div className="text-4xl font-bold text-amber-400 leading-none">{serving ? `#${serving.queueNumber}` : '—'}</div>
              </div>
              <div className="text-sm text-gray-700 space-y-1">
                <div>{t('queueMgmt.doctor')}: <strong className="text-gray-900">{withDrPrefix(serving?.doctorId?.userId?.name) || '—'}</strong></div>
                <div>{t('queueMgmt.patient')}: <strong className="text-gray-900">{serving?.patientId?.userId?.name || '—'}</strong></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="text-sm font-bold text-blue-900 mb-3">{t('queueMgmt.queueSummary')}</div>
              <div className="space-y-1">
                {summaryCounts.map(({ label, count, color }) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className={`text-sm font-bold ${color}`}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueManagement;
