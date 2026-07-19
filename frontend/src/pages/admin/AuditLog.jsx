/**
 * AuditLog.jsx — admin view of the audit trail ("who did what, when").
 * Paginated list from /admin/audit-logs with action filtering and search;
 * each action type gets its own colour chip (palette below).
 */
import { Fragment, useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Search, Filter, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import adminService from '../../api/services/AdminApiService';

// Semantic palette harmonised with brand blue:
// create = green · update = blue/sky · delete = red · cancel = rose
// roles = purple · assign/import = indigo · status = amber
const ACTION_COLORS = {
  USER_CREATE:        'bg-green-100 text-green-700',
  USER_DELETE:        'bg-red-100 text-red-700',
  USER_UPDATE:        'bg-blue-100 text-blue-700',
  ROLE_CHANGE:        'bg-purple-100 text-purple-700',
  STATUS_CHANGE:      'bg-amber-100 text-amber-700',
  APPOINTMENT_CANCEL: 'bg-rose-100 text-rose-700',
  CLINIC_CREATE:      'bg-green-100 text-green-700',
  CLINIC_UPDATE:      'bg-sky-100 text-sky-700',
  CLINIC_DELETE:      'bg-red-100 text-red-700',
  STAFF_CLINIC_ASSIGN:'bg-indigo-100 text-indigo-700',
  BULK_IMPORT:        'bg-indigo-100 text-indigo-700',
  APPOINTMENT_UPDATE: 'bg-sky-100 text-sky-700',
  RECORD_UPDATE:      'bg-blue-100 text-blue-700',
  RECORD_DELETE:      'bg-red-100 text-red-700',
  ROLE_PERMISSIONS_UPDATE: 'bg-purple-100 text-purple-700',
};

const ACTION_LABELS = {
  USER_CREATE:        'User Created',
  USER_DELETE:        'User Deleted',
  USER_UPDATE:        'User Updated',
  ROLE_CHANGE:        'Role Changed',
  STATUS_CHANGE:      'Status Changed',
  APPOINTMENT_CANCEL: 'Appt Cancelled',
  CLINIC_CREATE:      'Clinic Created',
  CLINIC_UPDATE:      'Clinic Updated',
  CLINIC_DELETE:      'Clinic Deleted',
  STAFF_CLINIC_ASSIGN:'Clinic Assigned',
  BULK_IMPORT:        'Bulk Import',
  APPOINTMENT_UPDATE: 'Appt Updated',
  RECORD_UPDATE:      'Record Updated',
  RECORD_DELETE:      'Record Deleted',
  ROLE_PERMISSIONS_UPDATE: 'Permissions Changed',
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

// Timestamp → readable local date/time.
const formatDate = (iso) =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

// Page component.
const AuditLog = () => {
  const { t } = useTranslation();
  const [logs, setLogs]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [pages, setPages]     = useState(1);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [search, setSearch]     = useState('');
  const [action, setAction]     = useState('');
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [expanded, setExpanded] = useState(null);

  const fetchLogs = useCallback(async (pg = page) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: pg, limit: 30 };
      if (search) params.search = search;
      if (action) params.action = action;
      if (from)   params.from   = from;
      if (to)     params.to     = to;
      const res = await adminService.getAuditLogs(params);
      setLogs(res.logs);
      setTotal(res.total);
      setPages(res.pages);
      setPage(res.page);
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, search, action, from, to]);

  useEffect(() => { fetchLogs(1); }, []); // eslint-disable-line

  // Apply the search/filter form (resets to page 1).
  const handleSearch = (e) => { e.preventDefault(); fetchLogs(1); };
  // Clear all filters.
  const handleReset  = () => {
    setSearch(''); setAction(''); setFrom(''); setTo('');
    setTimeout(() => fetchLogs(1), 0);
  };

  return (
    <div className="pl-56 pt-16 min-h-screen">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <ShieldCheck size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{t('auditLog.title')}</h1>
              <p className="text-sm text-gray-500">{total.toLocaleString()} {t('auditLog.totalEvents')}</p>
            </div>
          </div>
          <button type="button" onClick={() => fetchLogs(page)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('auditLog.refresh')}
          </button>
        </div>

        {/* Filter bar: free-text search, action type, from/to dates */}
        <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t('auditLog.searchPlaceholder')}
                className="w-full pl-9 pr-3 h-9 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={action} onChange={(e) => setAction(e.target.value)}
              className="h-9 border border-gray-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">{t('auditLog.allActions')}</option>
              {ALL_ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
            </select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="h-9 border border-gray-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="h-9 border border-gray-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              <Filter size={13} /> {t('auditLog.apply')}
            </button>
            <button type="button" onClick={handleReset} className="px-4 py-1.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              {t('auditLog.reset')}
            </button>
          </div>
        </form>

        {error && <div className="bg-red-50 border-l-4 border-red-400 text-red-700 rounded-xl p-3 text-sm mb-4">{error}</div>}

        {/* Events table — click a row to expand its details JSON */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">{t('common.loading')}</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ShieldCheck size={36} className="mb-3 opacity-30" />
              <p className="text-sm">{t('auditLog.noEvents')}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {[t('auditLog.action'), t('auditLog.performedBy'), t('auditLog.target'), t('auditLog.date'), t('auditLog.details')].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <Fragment key={log._id}>
                    <tr className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpanded(expanded === log._id ? null : log._id)}>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{log.performedBy?.name || '—'}</div>
                        <div className="text-xs text-gray-400 capitalize">{log.performedBy?.role}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700">{log.targetName || '—'}</div>
                        {log.targetModel && <div className="text-xs text-gray-400">{log.targetModel}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-blue-500 hover:underline">
                        {expanded === log._id ? t('auditLog.hide') : t('auditLog.view')}
                      </td>
                    </tr>
                    {expanded === log._id && (
                      <tr className="bg-blue-50">
                        <td colSpan={5} className="px-6 py-3">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                          {log.ip && <p className="text-xs text-gray-400 mt-1">IP: {log.ip}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Prev/next pagination (only when there is more than one page) */}
        {pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">{t('auditLog.page')} {page} {t('auditLog.of')} {pages}</p>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <ChevronLeft size={14} /> {t('auditLog.prev')}
              </button>
              <button type="button" disabled={page >= pages} onClick={() => fetchLogs(page + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                {t('auditLog.next')} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
