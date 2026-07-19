/**
 * QueueDisplay — reusable table of today's queue tokens for a clinic.
 *
 * Used by both staff (read-only live view) and doctors (with action
 * buttons). Callbacks are optional: pass onStatusChange / onSkip /
 * onOpenHistory only where those actions should appear.
 */
import { withDrPrefix } from '../utils/names';

// Chip colour + label for each queue status.
const statusStyles = {
  waiting:   { cls: 'bg-blue-100 text-blue-700',   label: 'Waiting' },
  serving:   { cls: 'bg-green-100 text-green-700',  label: 'Serving' },
  completed: { cls: 'bg-gray-100 text-gray-600',    label: 'Done' },
  skipped:   { cls: 'bg-red-100 text-red-700',      label: 'Skipped' },
};

// Component — renders the queue table (with an empty state).
const QueueDisplay = ({ queue = [], onStatusChange, onSkip, onOpenHistory }) => {
  if (!queue.length) {
    return (
      <div className="border-2 border-dashed border-blue-100 rounded-xl p-8 text-center text-gray-400 text-sm">
        No queue tokens found for this clinic today.
      </div>
    );
  }

  const hasActions = onStatusChange || onSkip || onOpenHistory;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-blue-50">
            {['#', 'Patient', 'Doctor', 'Position', 'Est. Wait', 'Status', ...(hasActions ? [''] : [])].map((h) => (
              <th key={h} className="text-left text-xs font-bold uppercase tracking-wide text-blue-900 px-4 py-3 border-b-2 border-blue-100">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {queue.map((item) => {
            const s = statusStyles[item.status] || { cls: 'bg-gray-100 text-gray-600', label: item.status };
            return (
              <tr key={item._id} className="hover:bg-blue-50/50 transition-colors">
                <td className="px-4 py-3 font-bold text-blue-900">#{item.queueNumber}</td>
                <td className="px-4 py-3 text-gray-800">{item.patientId?.userId?.name || 'Patient'}</td>
                <td className="px-4 py-3 text-gray-500">{withDrPrefix(item.doctorId?.userId?.name) || 'Doctor'}</td>
                <td className="px-4 py-3 text-gray-600">{item.position || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{item.estimatedWaitTime ?? 0} min</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold rounded-full px-2.5 py-1 ${s.cls}`}>{s.label}</span>
                </td>
                {hasActions && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {onOpenHistory && (
                        <button type="button" onClick={() => onOpenHistory(item)}
                          className="text-xs border border-gray-200 text-gray-600 rounded-lg px-3 py-1 hover:bg-blue-50 transition-colors">
                          History
                        </button>
                      )}
                      {onSkip && item.status !== 'skipped' && (
                        <button type="button" onClick={() => onSkip(item._id)}
                          className="text-xs border border-red-200 text-red-600 rounded-lg px-3 py-1 hover:bg-red-50 transition-colors">
                          Skip
                        </button>
                      )}
                      {onStatusChange && (
                        <select className="h-7 border border-gray-200 rounded-lg px-2 text-xs bg-white outline-none"
                          value={item.status} onChange={(e) => onStatusChange(item._id, e.target.value)}>
                          {['waiting', 'serving', 'completed', 'skipped'].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default QueueDisplay;
