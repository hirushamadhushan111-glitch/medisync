/**
 * PatientDashboard.jsx — the patient's home page.
 * Shows their appointments, live queue token (updated over the socket),
 * and recent notifications, with quick links to the other patient pages.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { appointmentService, notificationService, queueService } from '../../api';
import { clinicDisplayName } from '../../utils/clinicTypes';
import { withDrPrefix } from '../../utils/names';
import { useSocket } from '../../context/SocketContext.jsx';

// Page component.
const PatientDashboard = () => {
  const { t } = useTranslation();
  const { socket } = useSocket();
  const [appointments, setAppointments] = useState([]);
  const [queue, setQueue] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch appointments, notifications and my queue token.
  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [appts, notifs] = await Promise.all([
        appointmentService.getMyAppointments(),
        notificationService.getAll(),
      ]);
      setAppointments(appts);
      setNotifications(notifs);
      try {
        const queueData = await queueService.getMyQueue();
        setQueue(queueData);
      } catch {
        setQueue(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  useEffect(() => {
    const clinicId = queue?.queue?.clinicId?._id || queue?.queue?.clinicId;
    if (!socket || !clinicId || !queue?.queue?._id) return undefined;
    socket.emit('join-clinic', clinicId);
    // Live refresh of my token from the clinic's queue broadcast.
    const handleUpdate = (updatedQueue) => {
      const updatedMyQueue = updatedQueue.find((item) => item._id === queue.queue._id);
      const currentServing = updatedQueue.find((item) => item.status === 'serving');
      if (updatedMyQueue) {
        const peopleAhead = updatedQueue.filter(
          (item) => item.position > 0 && item.position < updatedMyQueue.position && ['waiting', 'serving'].includes(item.status)
        ).length;
        setQueue((current) => ({
          ...current, queue: updatedMyQueue, queueNumber: updatedMyQueue.queueNumber,
          position: updatedMyQueue.position, estimatedWaitTime: updatedMyQueue.estimatedWaitTime,
          status: updatedMyQueue.status, currentServing: currentServing?.queueNumber || null, peopleAhead,
        }));
      } else {
        setQueue((current) => ({ ...current, currentServing: currentServing?.queueNumber || null }));
      }
    };
    // Alert shown when MY number is called.
    const handleCalled = (payload) => {
      if (payload._id !== queue.queue._id) return;
      setQueue((current) => ({
        ...current, queue: payload, queueNumber: payload.queueNumber,
        position: payload.position, estimatedWaitTime: payload.estimatedWaitTime,
        currentServing: payload.queueNumber, peopleAhead: 0, status: payload.status,
      }));
      window.alert(`Queue number ${payload.queueNumber} is now being served.`);
    };
    socket.on('queue:updated', handleUpdate);
    socket.on('queue:token_called', handleCalled);
    return () => {
      socket.emit('leave-clinic', clinicId);
      socket.off('queue:updated', handleUpdate);
      socket.off('queue:token_called', handleCalled);
    };
  }, [socket, queue?.queue?._id, queue?.queue?.clinicId?._id, queue?.queue?.clinicId]);

  // Cancel a booking after confirmation (queue recalculated server-side).
  const cancelAppointment = async (id) => {
    if (!window.confirm(t('patientDashboard.cancelConfirm'))) return;
    try {
      await appointmentService.cancel(id);
      setAppointments((prev) => prev.map((a) => a._id === id ? { ...a, status: 'cancelled' } : a));
    } catch {
      alert(t('patientDashboard.cancelFailed'));
    }
  };

  const upcoming = appointments.filter((item) => ['pending', 'confirmed'].includes(item.status)).slice(0, 3);
  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h1 className="text-2xl font-bold text-blue-900 m-0">{t('patientDashboard.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('patientDashboard.subtitle')}</p>
          </div>
          <Link
            className="bg-amber-400 hover:bg-amber-500 text-blue-900 font-bold rounded-xl px-4 py-2 text-sm no-underline transition-colors"
            to="/patient/book"
          >
            {t('patientDashboard.bookAppointment')}
          </Link>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-400 text-sm">
            {t('patientDashboard.loadingDashboard')}
          </div>
        ) : (
          <>
            {/* Three stat cards: upcoming bookings, my queue token, unread alerts.
                The token card turns amber while the patient is in a live queue. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{t('patientDashboard.upcoming')}</div>
                <div className="text-3xl font-bold text-blue-900 leading-none">{upcoming.length}</div>
                <div className="text-xs text-gray-400 mt-1">{t('patientDashboard.appointments')}</div>
              </div>

              <div className={`rounded-2xl shadow-sm border p-5 ${queue ? 'bg-amber-400 border-amber-300' : 'bg-white border-gray-100'}`}>
                <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${queue ? 'text-blue-900' : 'text-gray-500'}`}>
                  {t('patientDashboard.queueNumber')}
                </div>
                <div className="text-3xl font-bold leading-none text-blue-900">
                  {queue ? `#${queue.queueNumber}` : '—'}
                </div>
                <div className={`text-xs mt-1 ${queue ? 'text-blue-800' : 'text-gray-400'}`}>
                  {queue ? `${queue.estimatedWaitTime} ${t('patientDashboard.minWait')}` : t('patientDashboard.noActiveQueue')}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">{t('patientDashboard.unreadAlerts')}</div>
                <div className="text-3xl font-bold text-blue-900 leading-none">{unreadCount}</div>
                <div className="text-xs text-gray-400 mt-1">{t('patientDashboard.notifications')}</div>
              </div>
            </div>

            {/* Live queue card (only while queued): now serving / my position / people ahead */}
            {queue && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-blue-900 font-bold text-lg">{t('patientDashboard.liveQueueStatus')}</span>
                  <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse" />
                    {t('patientDashboard.live')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    [t('patientDashboard.nowServing'), `#${queue.currentServing || '—'}`, true],
                    [t('patientDashboard.yourPosition'), queue.position ?? '—', false],
                    [t('patientDashboard.peopleAhead'), queue.peopleAhead ?? '—', false],
                  ].map(([label, val, highlight]) => (
                    <div key={label} className={`text-center rounded-xl py-4 ${highlight ? 'bg-blue-900' : 'bg-blue-50'}`}>
                      <div className={`text-xs mb-1 ${highlight ? 'text-blue-300' : 'text-gray-500'}`}>{label}</div>
                      <div className={`text-3xl font-bold ${highlight ? 'text-amber-400' : 'text-blue-900'}`}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom row: upcoming appointments (cancellable) + recent notifications */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="text-blue-900 font-bold text-lg mb-4">{t('patientDashboard.upcomingAppointments')}</div>
                {upcoming.length === 0 ? (
                  <div className="text-gray-400 text-sm text-center py-6">{t('patientDashboard.noUpcoming')}</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {upcoming.map((item) => (
                      <div key={item._id} className="py-3 flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{clinicDisplayName(item.clinicId, t)}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {new Date(item.appointmentDate).toLocaleDateString()} {t('patientDashboard.at')} {item.appointmentTime} · {withDrPrefix(item.doctorId?.userId?.name)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => cancelAppointment(item._id)}
                          className="flex-shrink-0 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg px-2.5 py-1 transition-colors"
                        >
                          {t('patientDashboard.cancelAppointment')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="text-blue-900 font-bold text-lg mb-4">{t('patientDashboard.recentNotifications')}</div>
                {notifications.length === 0 ? (
                  <div className="text-gray-400 text-sm text-center py-6">{t('patientDashboard.noNotifications')}</div>
                ) : (
                  <div className="space-y-1">
                    {notifications.slice(0, 5).map((item) => (
                      <div key={item._id} className={`py-2.5 px-3 rounded-lg transition-colors ${item.isRead ? 'bg-white' : 'bg-blue-50 border-l-4 border-blue-600'}`}>
                        <div className="text-sm text-gray-800">{item.message}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{new Date(item.createdAt).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;
