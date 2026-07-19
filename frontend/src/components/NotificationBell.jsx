/**
 * NotificationBell — the navbar bell icon.
 *
 * Shows the unread count, a dropdown of recent notifications, and a
 * temporary pop-up toast when a new notification arrives live over the
 * socket ('notification' event). Also uses the browser Notification API
 * when the user has granted permission.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { notificationService } from '../api';
import { useSocket } from '../context/SocketContext.jsx';

// Component (see header).
const NotificationBell = () => {
  const { t } = useTranslation();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [marking, setMarking] = useState(false);
  const containerRef = useRef(null);

  const unread = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications]);

  // Fetch my notifications.
  const loadNotifications = async () => {
    try {
      const notifications = await notificationService.getAll();
      setNotifications(notifications);
    } catch {
      setNotifications([]);
    }
  };

  useEffect(() => { loadNotifications(); }, []);

  // Close the dropdown when clicking anywhere outside it
  useEffect(() => {
    if (!open) return undefined;
    // Close the dropdown on an outside click.
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  // Live notifications pushed from the server over Socket.IO.
  useEffect(() => {
    if (!socket) return undefined;
    // New live notification → list + toast (+ browser notification).
    const handleNotification = (notification) => {
      setNotifications((current) => [notification, ...current]);
      setToast(notification);
      window.setTimeout(() => setToast(null), 6000);
      if ('Notification' in window && window.Notification.permission === 'granted') {
        new window.Notification('MediSync', { body: notification.message });
      }
    };
    socket.on('notification', handleNotification);
    return () => socket.off('notification', handleNotification);
  }, [socket]);

  // Mark every notification as read.
  const markAll = async () => {
    if (marking) return;
    try {
      setMarking(true);
      await notificationService.markAllRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch {
      await loadNotifications();
    } finally {
      setMarking(false);
    }
  };

  return (
    <>
      {/* Bell button — the amber badge shows the unread count */}
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="relative p-2 rounded-xl hover:bg-blue-50 transition-colors"
        >
          <Bell size={20} className="text-gray-500" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-amber-400 text-blue-900 rounded-full text-[9px] font-bold flex items-center justify-center leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* Dropdown — latest 8 notifications, unread rows tinted blue */}
        {open && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl shadow-blue-100 border border-gray-100 z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-2">
              <span className="text-sm font-bold text-blue-900">{t('notifBell.title')}</span>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markAll}
                    disabled={marking}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-blue-50"
                  >
                    {marking ? t('notifBell.marking') : t('notifBell.markAllRead')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t('common.close')}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-400 text-center">
                  {t('notifBell.empty')}
                </div>
              ) : (
                notifications.slice(0, 8).map((item) => (
                  <div
                    key={item._id}
                    className={`px-4 py-3 border-b border-gray-50 text-sm ${
                      item.isRead ? '' : 'bg-blue-50 border-l-4 border-l-blue-600'
                    }`}
                  >
                    <div className="text-gray-800 leading-snug">{item.message}</div>
                    <div className="text-xs text-gray-400 mt-1">{new Date(item.createdAt).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pop-up toast for a notification that just arrived via socket */}
      {toast && (
        <div className="fixed top-20 right-5 z-[2000] w-80 bg-blue-900 text-white rounded-2xl shadow-2xl p-4 border-l-4 border-amber-400 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center flex-shrink-0">
            <Bell size={14} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-amber-400 mb-0.5">MediSync</div>
            <div className="text-sm leading-snug">{toast.message}</div>
          </div>
          <button type="button" onClick={() => setToast(null)} className="text-blue-300 hover:text-white text-lg leading-none flex-shrink-0">×</button>
        </div>
      )}
    </>
  );
};

export default NotificationBell;
