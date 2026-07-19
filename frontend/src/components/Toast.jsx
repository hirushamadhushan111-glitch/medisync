/**
 * Toast — the app's standard success/error pop-ups.
 *
 * Usage on any page:
 *   <Toast error={error} message={message}
 *          onClearError={…} onClearMessage={…} />
 *
 * Fixed top-right notifications replacing the old in-page banners:
 * visible without scrolling back up and auto-dismissed after 5 seconds.
 */
import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const AUTO_HIDE_MS = 5000;

const styles = {
  success: 'bg-green-50 border-green-500 text-green-700',
  error:   'bg-red-50 border-red-500 text-red-700',
};

const icons = { success: CheckCircle2, error: AlertCircle };

// One toast box; auto-closes after 5 seconds.
const ToastItem = ({ type, text, onClose }) => {
  useEffect(() => {
    const timer = window.setTimeout(onClose, AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  const Icon = icons[type];
  return (
    <div role="alert"
      className={`pointer-events-auto flex items-start gap-2.5 border-l-4 rounded-xl p-3 text-sm shadow-lg animate-toast-in ${styles[type]}`}>
      <Icon size={18} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 font-medium">{text}</div>
      <button type="button" onClick={onClose} aria-label="Dismiss"
        className="flex-shrink-0 p-0.5 opacity-60 hover:opacity-100 transition-opacity">
        <X size={14} />
      </button>
    </div>
  );
};

// Container that stacks the error/success toasts (top-right).
const Toast = ({ error, message, onClearError, onClearMessage }) => {
  if (!error && !message) return null;
  return (
    <div className="fixed top-20 right-4 z-[999] w-[min(92vw,380px)] flex flex-col gap-2 pointer-events-none">
      {error ? <ToastItem type="error" text={error} onClose={onClearError} /> : null}
      {message ? <ToastItem type="success" text={message} onClose={onClearMessage} /> : null}
    </div>
  );
};

export default Toast;
