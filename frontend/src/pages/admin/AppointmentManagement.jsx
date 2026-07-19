/**
 * AppointmentManagement.jsx — admin page over ALL appointments (UC18).
 * Search by patient/NIC/doctor, filter by status, change an
 * appointment's status, or cancel it (cancelling also recalculates
 * the day's queue on the server).
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, Search, RefreshCw } from 'lucide-react';
import { appointmentService } from '../../api';
import { clinicDisplayName } from '../../utils/clinicTypes';
import { withDrPrefix } from '../../utils/names';
import Toast from '../../components/Toast.jsx';

const inputClass = 'h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none placeholder:text-gray-400';

const STATUS_STYLES = {
  pending:   'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

// Page component.
const AppointmentManagement = () => {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Fetch every appointment for the table.
  const load = async () => {
    setLoading(true); setError('');
    try {
      setAppointments(await appointmentService.getAll());
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => appointments.filter((appt) => {
    if (statusFilter && appt.status !== statusFilter) return false;
    if (dateFilter) {
      const apptDay = new Date(appt.appointmentDate).toISOString().slice(0, 10);
      if (apptDay !== dateFilter) return false;
    }
    if (search) {
      const term = search.toLowerCase();
      const patient = appt.patientId?.userId?.name || '';
      const nic     = appt.patientId?.userId?.NIC || appt.patientId?.NIC || '';
      const doctor  = appt.doctorId?.userId?.name || '';
      if (![patient, nic, doctor].some((v) => v.toLowerCase().includes(term))) return false;
    }
    return true;
  }), [appointments, search, statusFilter, dateFilter]);

  // Set an appointment's status via the API.
  const changeStatus = async (appt, status) => {
    setError(''); setMessage('');
    try {
      await appointmentService.updateStatus(appt._id, status);
      setMessage(t('apptMgmt.updated'));
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    }
  };

  // Cancel after confirmation — the server also recalculates the queue.
  const cancelAppt = async (appt) => {
    if (!window.confirm(t('apptMgmt.cancelConfirm'))) return;
    setError(''); setMessage('');
    try {
      await appointmentService.cancel(appt._id);
      setMessage(t('apptMgmt.cancelled'));
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    }
  };

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <CalendarCheck size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-900">{t('apptMgmt.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('apptMgmt.subtitle')}</p>
          </div>
        </div>

        <Toast error={error} message={message} onClearError={() => setError('')} onClearMessage={() => setMessage('')} />

        {/* Filter bar: search by name, status dropdown, date picker */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className={`${inputClass} w-full pl-9`} placeholder={t('apptMgmt.searchPlaceholder')}
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t('apptMgmt.allStatuses')}</option>
            {['pending', 'confirmed', 'completed', 'cancelled'].map((s) => (
              <option key={s} value={s}>{t(`apptMgmt.status_${s}`)}</option>
            ))}
          </select>
          <input type="date" className={inputClass} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          <button type="button" onClick={load}
            className="h-10 px-4 flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl text-sm transition-colors">
            <RefreshCw size={14} /> {t('common.refresh')}
          </button>
        </div>

        {/* Appointments table — status is editable inline via the dropdown;
            Cancel is disabled once completed/cancelled */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="text-base font-bold text-blue-900 mb-4">
            {t('apptMgmt.listTitle')} <span className="text-xs font-semibold text-gray-400 ml-1">({filtered.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50">
                  {[t('apptMgmt.patient'), t('apptMgmt.doctor'), t('apptMgmt.clinic'), t('apptMgmt.date'),
                    t('apptMgmt.time'), t('apptMgmt.type'), t('apptMgmt.queueNo'), t('apptMgmt.statusCol'), ''].map((h, i) => (
                    <th key={i} className="text-left text-xs font-bold text-blue-900 uppercase tracking-wide px-4 py-3 border-b-2 border-blue-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center text-gray-400 py-10">{t('common.loading')}</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center text-gray-400 py-10">{t('apptMgmt.noAppointments')}</td></tr>
                ) : filtered.map((appt) => (
                  <tr key={appt._id} className="border-b border-gray-50 hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900">{appt.patientId?.userId?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{withDrPrefix(appt.doctorId?.userId?.name) || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{appt.clinicId ? clinicDisplayName(appt.clinicId, t) : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(appt.appointmentDate).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-3 text-gray-600">{appt.appointmentTime}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${appt.bookingType === 'walk-in' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {appt.bookingType === 'walk-in' ? t('apptMgmt.walkIn') : t('apptMgmt.online')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">#{appt.queueNumber ?? '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        className={`h-7 border border-gray-200 rounded-lg px-2 text-xs outline-none font-semibold ${STATUS_STYLES[appt.status] || 'bg-white'}`}
                        value={appt.status}
                        onChange={(e) => changeStatus(appt, e.target.value)}>
                        {['pending', 'confirmed', 'completed', 'cancelled'].map((s) => (
                          <option key={s} value={s}>{t(`apptMgmt.status_${s}`)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => cancelAppt(appt)}
                        disabled={appt.status === 'cancelled' || appt.status === 'completed'}
                        className="text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                        {t('apptMgmt.cancelBtn')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentManagement;
