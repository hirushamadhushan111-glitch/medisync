/**
 * QueueDisplayScreen.jsx — the staff-side big queue display.
 * Full-screen-capable "Now Serving" board for the selected clinic with a
 * live clock; updates arrive over the clinic's Socket.IO room.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { queueService } from '../../api';
import { clinicDisplayName, clinicTypeLabel } from '../../utils/clinicTypes';
import { withDrPrefix } from '../../utils/names';
import { useSocket } from '../../context/SocketContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useClinic } from '../../context/ClinicContext.jsx';
import Toast from '../../components/Toast.jsx';

// Ticking clock — re-renders once per second.
const useClock = () => {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
};

// Page component.
const QueueDisplayScreen = () => {
  const { t } = useTranslation();
  const { socket } = useSocket();
  const { isDark } = useTheme();
  const displayRef = useRef(null);
  // Shared app-wide clinic selection (navbar selector + this page's dropdown)
  const { clinics, activeClinic, setActiveClinic } = useClinic();
  const clinicId = activeClinic?._id || '';
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const time = useClock();

  useEffect(() => {
    if (!clinicId) return;
    queueService.getLive(clinicId)
      .then((q) => setQueue(q))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load queue.'));
  }, [clinicId]);

  useEffect(() => {
    if (!socket || !clinicId) return undefined;
    socket.emit('join-clinic', clinicId);
    // Live queue refresh from the socket.
    const handleUpdate = (updated) => setQueue(updated || []);
    socket.on('queue:updated', handleUpdate);
    return () => { socket.emit('leave-clinic', clinicId); socket.off('queue:updated', handleUpdate); };
  }, [socket, clinicId]);

  // Fullscreen
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await displayRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  useEffect(() => {
    // Keep the fullscreen button icon in sync with the browser state.
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const clinic = clinics.find((c) => c._id === clinicId);
  const current = queue.find((q) => q.status === 'serving');
  const waiting = useMemo(() => queue.filter((q) => q.status === 'waiting').slice(0, 6), [queue]);

  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const darkBg = isDark ? 'bg-[#0a0a0f]' : 'bg-blue-50';
  const cardBg = isDark ? 'bg-gray-900 border border-gray-700/60' : 'bg-blue-900';
  const serveCardGlow = isDark ? 'shadow-[0_0_50px_rgba(251,191,36,0.12)]' : 'shadow-xl';
  const nextCardGlow  = isDark ? 'shadow-[0_0_30px_rgba(0,0,0,0.4)]' : 'shadow-xl';

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        {/* Page header — outside the fullscreen area */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-5">
          <div>
            <div className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-1">MediSync Live Queue</div>
            <h1 className="text-2xl font-bold text-blue-900">{clinic ? clinicDisplayName(clinic, t) : t('nav.selectClinic')}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{clinic ? clinicTypeLabel(clinic.departmentType, t) : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="h-10 border border-gray-200 bg-white text-gray-700 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              value={clinicId}
              onChange={(e) => setActiveClinic(clinics.find((c) => c._id === e.target.value))}
            >
              {clinics.map((c) => <option key={c._id} value={c._id}>{clinicDisplayName(c, t)}</option>)}
            </select>
            <button
              type="button"
              onClick={toggleFullscreen}
              title="Fullscreen TV display"
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-900 text-white hover:bg-blue-800 transition-colors shadow-sm"
            >
              <Maximize2 size={18} />
            </button>
          </div>
        </div>

        <Toast error={error} onClearError={() => setError('')} />

        {/* ── Fullscreen-able display area ── */}
        <div
          id="queue-fullscreen-area"
          ref={displayRef}
          className={`${darkBg} ${isFullscreen ? 'p-10' : 'rounded-3xl p-6'} transition-colors duration-300`}
        >
          {/* Fullscreen header (only shown when fullscreen) */}
          {isFullscreen && (
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-blue-400' : 'text-blue-300'}`}>
                  MediSync Live Queue
                </div>
                <div className="text-3xl font-bold text-white">{clinicDisplayName(clinic, t)}</div>
                <div className={`text-sm mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-300'}`}>{clinicTypeLabel(clinic?.departmentType, t)}</div>
              </div>

              <div className="text-right">
                <div className={`text-4xl font-bold tabular-nums ${isDark ? 'text-amber-400' : 'text-amber-400'}`}>{timeStr}</div>
                <div className={`text-sm mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-300'}`}>{dateStr}</div>
              </div>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <Minimize2 size={18} />
              </button>
            </div>
          )}

          {/* Queue data grid */}
          <div className={`grid gap-5 ${isFullscreen ? 'grid-cols-2 flex-1' : 'grid-cols-1 xl:grid-cols-2'}`}>

            {/* Now Serving */}
            <div className={`${cardBg} ${serveCardGlow} rounded-3xl flex flex-col items-center justify-center text-center ${isFullscreen ? 'py-16' : 'p-10'}`}>
              <div className={`text-xs font-bold uppercase tracking-widest mb-6 ${isDark ? 'text-blue-400' : 'text-blue-300'}`}>
                Now Serving
              </div>

              {current ? (
                <>
                  <div className={`font-extrabold text-amber-400 leading-none mb-4 ${isFullscreen ? 'text-[12rem]' : 'text-9xl'}`}>
                    #{current.queueNumber}
                  </div>
                  <div className={`text-lg ${isDark ? 'text-blue-300' : 'text-blue-100'}`}>
                    {withDrPrefix(current.doctorId?.userId?.name) || 'Now being served'}
                  </div>
                  {isFullscreen && (
                    <div className="mt-4 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-green-400 text-sm font-medium">Live</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className={`font-extrabold text-blue-700 leading-none mb-4 ${isFullscreen ? 'text-[10rem]' : 'text-9xl'}`}>
                    --
                  </div>
                  <div className={isDark ? 'text-blue-500' : 'text-blue-400'}>Please wait for the next call</div>
                </>
              )}
            </div>

            {/* Next Numbers */}
            <div className={`${cardBg} ${nextCardGlow} rounded-3xl ${isFullscreen ? 'p-10' : 'p-8'}`}>
              <div className={`text-xs font-bold uppercase tracking-widest mb-6 ${isDark ? 'text-blue-400' : 'text-blue-300'}`}>
                Next Numbers
              </div>

              {waiting.length > 0 ? (
                <div className="space-y-3">
                  {waiting.map((item, idx) => (
                    <div
                      key={item._id}
                      className={`flex items-center justify-between rounded-2xl px-5 py-4 ${
                        isDark
                          ? 'bg-gray-800/70 border border-gray-600/40'
                          : 'bg-white/10 border border-white/10'
                      } ${isFullscreen ? 'py-5' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        {idx === 0 && (
                          <span className="text-[10px] font-bold bg-amber-400 text-blue-900 rounded-full px-2 py-0.5 uppercase">Next</span>
                        )}
                        <span className={`font-bold text-white ${isFullscreen ? 'text-4xl' : 'text-3xl'}`}>
                          #{item.queueNumber}
                        </span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${isDark ? 'text-blue-400' : 'text-blue-300'} text-sm`}>
                        <Clock size={13} />
                        {item.estimatedWaitTime} min
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center ${isFullscreen ? 'py-20' : 'py-10'}`}>
                  <div className={`text-5xl mb-4 ${isDark ? 'text-blue-800' : 'text-blue-800'}`}>○</div>
                  <div className={isDark ? 'text-blue-500 text-sm' : 'text-blue-400 text-sm'}>
                    No patients waiting
                  </div>
                </div>
              )}

              {/* Summary bar */}
              {isFullscreen && queue.length > 0 && (
                <div className={`mt-6 pt-5 border-t ${isDark ? 'border-blue-900/50' : 'border-white/10'} flex justify-around`}>
                  {[
                    ['Waiting', queue.filter((q) => q.status === 'waiting').length],
                    ['Serving', queue.filter((q) => q.status === 'serving').length],
                    ['Completed', queue.filter((q) => q.status === 'completed').length],
                  ].map(([label, count]) => (
                    <div key={label} className="text-center">
                      <div className="text-3xl font-bold text-white">{count}</div>
                      <div className={`text-xs uppercase tracking-wide mt-1 ${isDark ? 'text-blue-500' : 'text-blue-400'}`}>{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Inline stats bar (non-fullscreen) */}
          {!isFullscreen && queue.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              {[
                ['Waiting', queue.filter((q) => q.status === 'waiting').length, isDark ? 'text-blue-400' : 'text-blue-300'],
                ['Serving', queue.filter((q) => q.status === 'serving').length, 'text-amber-400'],
                ['Completed', queue.filter((q) => q.status === 'completed').length, 'text-green-400'],
              ].map(([label, count, color]) => (
                <div
                  key={label}
                  className={`${isDark ? 'bg-gray-900 border border-blue-900/40' : 'bg-blue-900/60'} rounded-2xl p-4 text-center`}
                >
                  <div className={`text-3xl font-bold ${color}`}>{count}</div>
                  <div className={`text-xs uppercase tracking-wide mt-1 ${isDark ? 'text-blue-500' : 'text-blue-400'}`}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Clock bar (non-fullscreen) */}
          {!isFullscreen && (
            <div className={`mt-4 flex items-center justify-between px-2 ${isDark ? 'text-blue-600' : 'text-blue-800/40'} text-xs`}>
              <span>{dateStr}</span>
              <span className="font-mono font-semibold">{timeStr}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QueueDisplayScreen;
