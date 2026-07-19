/**
 * QueueStatus.jsx — the patient's live queue-token page.
 *
 * Shows today's token, position, people ahead, and "now serving" —
 * all updated in real time through the clinic's Socket.IO room. If the
 * patient holds tokens in several clinics today, they can switch between
 * them; an alert pops up when their turn is called or near.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { queueService } from '../../api';
import { clinicDisplayName } from '../../utils/clinicTypes';
import { withDrPrefix } from '../../utils/names';
import { useSocket } from '../../context/SocketContext.jsx';

// Page component.
const QueueStatus = () => {
  const { t } = useTranslation();
  const { socket } = useSocket();
  const [queueInfo, setQueueInfo] = useState(null);
  const [alert, setAlert] = useState('');
  const [error, setError] = useState('');

  // Fetch my live token (optionally a specific one by id).
  const loadMyQueue = async (queueId) => {
    const data = await queueService.getMyQueue(queueId);
    setQueueInfo(data);
  };

  useEffect(() => {
    loadMyQueue().catch((err) => {
      setQueueInfo(null);
      setError(err.response?.data?.message || t('queueStatus.noToken'));
    });
  }, []);

  // Switch between my tokens when I hold several today.
  const switchToken = (queueId) => {
    if (queueId === queueInfo?.queue?._id) return;
    setAlert('');
    loadMyQueue(queueId).catch((err) => setError(err.response?.data?.message || t('common.error')));
  };

  useEffect(() => {
    const clinicId = queueInfo?.queue?.clinicId?._id;
    if (!socket || !clinicId) return undefined;
    socket.emit('join-clinic', clinicId);
    // Live position refresh from the clinic's queue broadcast.
    const handleUpdate = (updatedQueue) => {
      const updatedMyQueue = updatedQueue.find((item) => item._id === queueInfo.queue._id);
      const currentServing = updatedQueue.find((item) => item.status === 'serving');
      if (updatedMyQueue) {
        const peopleAhead = updatedQueue.filter(
          (item) => item.position > 0 && item.position < updatedMyQueue.position && ['waiting', 'serving'].includes(item.status)
        ).length;
        setQueueInfo((current) => ({
          ...current, queue: updatedMyQueue, queueNumber: updatedMyQueue.queueNumber,
          position: updatedMyQueue.position, estimatedWaitTime: updatedMyQueue.estimatedWaitTime,
          status: updatedMyQueue.status, currentServing: currentServing?.queueNumber || null, peopleAhead,
        }));
      } else {
        setQueueInfo((current) => ({ ...current, currentServing: currentServing?.queueNumber || null }));
      }
    };
    // Big alert when my number is called.
    const handleCalled = (payload) => {
      if (payload._id !== queueInfo.queue._id) return;
      setAlert(t('queueStatus.yourTurn'));
      setQueueInfo((current) => ({
        ...current, queue: payload, queueNumber: payload.queueNumber, position: payload.position,
        estimatedWaitTime: payload.estimatedWaitTime, status: payload.status,
        currentServing: payload.queueNumber, peopleAhead: 0,
      }));
    };
    // Banner when my doctor toggles availability.
    const handleDoctorStatus = (payload) => {
      if (payload.doctorId !== queueInfo.queue.doctorId?._id) return;
      setQueueInfo((current) => ({ ...current, doctorAvailable: payload.isAvailable }));
      if (!payload.isAvailable) setAlert(t('queueStatus.doctorUnavailable'));
    };
    socket.on('queue:updated', handleUpdate);
    socket.on('queue:token_called', handleCalled);
    socket.on('doctor:status_changed', handleDoctorStatus);
    return () => {
      socket.emit('leave-clinic', clinicId);
      socket.off('queue:updated', handleUpdate);
      socket.off('queue:token_called', handleCalled);
      socket.off('doctor:status_changed', handleDoctorStatus);
    };
  }, [socket, queueInfo?.queue?._id, queueInfo?.queue?.clinicId?._id]);

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">{t('queueStatus.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('queueStatus.subtitle')}</p>
        </div>

        {alert && <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-800 rounded-xl p-3 text-sm mb-4">{alert}</div>}
        {queueInfo?.doctorAvailable === false && (
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-800 rounded-xl p-3 text-sm mb-4">{t('queueStatus.queuePaused')}</div>
        )}
        {error && !queueInfo && (
          <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 rounded-xl p-3 text-sm mb-4">{error}</div>
        )}

        {queueInfo ? (
          <>
            {/* Token switcher — shown when the patient holds tokens in more than one clinic */}
            {queueInfo.tokens?.length > 1 && (
              <div className="mb-5">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">{t('queueStatus.myBookings')}</div>
                <div className="flex flex-wrap gap-2">
                  {queueInfo.tokens.map((token) => {
                    const active = token._id === queueInfo.queue?._id;
                    return (
                      <button
                        key={token._id}
                        type="button"
                        onClick={() => switchToken(token._id)}
                        className={`px-4 h-10 rounded-xl text-sm font-semibold transition-colors border ${
                          active
                            ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                            : 'bg-white text-blue-900 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {clinicDisplayName(token.clinicName, t)} · #{token.queueNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Big token number card (updates live via socket) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mb-5">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500 font-semibold uppercase tracking-wide mb-4">
                {t('queueStatus.yourQueueNumber')}
                <span className="flex items-center gap-1.5 text-green-600 font-medium text-xs lowercase tracking-normal">
                  <span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse" />
                  {t('queueStatus.live')}
                </span>
              </div>
              <div className="text-7xl font-extrabold text-blue-900 leading-none">#{queueInfo.queueNumber}</div>
              <div className="text-sm text-gray-500 mt-3">
                {clinicDisplayName(queueInfo.clinicName, t)} · {t('queueStatus.estWait')} <strong className="text-blue-900">{queueInfo.estimatedWaitTime} {t('queueStatus.min')}</strong>
              </div>
            </div>

            {/* Four stat tiles: now serving / my position / people ahead / est. wait */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              {[
                [t('queueStatus.nowServing'), `#${queueInfo.currentServing || '—'}`, true],
                [t('queueStatus.yourPosition'), queueInfo.position ?? '—', false],
                [t('queueStatus.peopleAhead'), queueInfo.peopleAhead ?? '—', false],
                [t('queueStatus.estWait'), `${queueInfo.estimatedWaitTime} ${t('queueStatus.min')}`, false],
              ].map(([label, val, highlight]) => (
                <div key={label} className={`rounded-2xl p-5 text-center ${highlight ? 'bg-blue-900' : 'bg-white border border-gray-100 shadow-sm'}`}>
                  <div className={`text-xs mb-1 font-semibold uppercase tracking-wide ${highlight ? 'text-blue-300' : 'text-gray-500'}`}>{label}</div>
                  <div className={`text-3xl font-bold ${highlight ? 'text-amber-400' : 'text-blue-900'}`}>{val}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="text-base font-bold text-blue-900 mb-4">{clinicDisplayName(queueInfo.clinicName, t)}</div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  [t('queueStatus.doctor'), withDrPrefix(queueInfo.doctorName) || '—'],
                  [t('queueStatus.status'), queueInfo.status],
                  [t('queueStatus.position'), queueInfo.position],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">{label}</div>
                    <div className="text-sm font-semibold text-gray-900 capitalize">{val}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-400 text-sm">
            {t('queueStatus.noToken')}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueStatus;
