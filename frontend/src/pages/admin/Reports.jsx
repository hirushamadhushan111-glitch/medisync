/**
 * Reports.jsx — admin analytics page.
 * Date-filtered daily summary, queue performance and peak-hour charts,
 * patient statistics, and a server-generated PDF export.
 */
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { reportService } from '../../api';
import Toast from '../../components/Toast.jsx';

// Date → 'YYYY-MM-DD' for API query params.
const isoDate = (date) => date.toISOString().slice(0, 10);

const inputClass = 'w-full h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';
const labelClass = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';

// Page component.
const Reports = () => {
  const { t } = useTranslation();
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 29);

  const [filters, setFilters] = useState({ date: isoDate(today), start: isoDate(monthAgo), end: isoDate(today) });
  const [daily, setDaily] = useState(null);
  const [patientStats, setPatientStats] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch all report datasets for the chosen dates.
  const load = async () => {
    setLoading(true); setError('');
    try {
      const range = { start: filters.start, end: filters.end };
      const [dailyData, queueData, patientData] = await Promise.all([
        reportService.getDailySummary(filters.date),
        reportService.getQueuePerformance(range),
        reportService.getPatientStats(range),
      ]);
      setDaily(dailyData);
      setPerformance((queueData.performance || []).map((item) => ({
        clinic: item.clinic?.clinicName || 'Clinic',
        wait: Math.round(item.averageWaitTime || 0),
        total: item.totalTokens, completed: item.completed,
      })));
      setPeakHours(queueData.peakHours || []);
      setOverview(queueData.overview || null);
      setPatientStats(patientData.stats || patientData);
    } catch (err) {
      setError(err.response?.data?.message || t('reports.failedLoad'));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Open the server-generated PDF report.
  const exportPdf = () => {
    const url = reportService.exportPdfUrl({ date: filters.date, start: filters.start, end: filters.end });
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `medisync-report-${filters.date}.pdf`;
    anchor.click();
  };

  // Chart data derived from the queue-performance rows.
  const monthlyVisits = (patientStats?.monthlyVisits || []).map((item) => ({
    month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
    visits: item.count,
  }));

  const summaryCards = [
    [t('reports.patientsSeen'),  daily?.uniquePatientsSeen || 0],
    [t('reports.consultations'), daily?.totalVisits || 0],
    [t('reports.avgWait'),       `${Math.round(overview?.averageWaitTime || 0)} ${t('reports.min')}`],
    [t('reports.queueEntries'),  overview?.totalQueueEntries || 0],
    [t('reports.peakHour'),      peakHours[0]?.label || '—'],
  ];

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">{t('reports.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('reports.subtitle')}</p>
          </div>
          <button type="button" onClick={exportPdf}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-4 py-2 text-sm transition-colors">
            {t('reports.exportPdf')}
          </button>
        </div>

        <Toast error={error} onClearError={() => setError('')} />

        {/* Filter bar: daily-summary date + start/end range, then Apply */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className={labelClass}>{t('reports.dailyDate')}</label>
              <input className={inputClass} type="date" value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{t('reports.rangeStart')}</label>
              <input className={inputClass} type="date" value={filters.start}
                onChange={(e) => setFilters({ ...filters, start: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>{t('reports.rangeEnd')}</label>
              <input className={inputClass} type="date" value={filters.end}
                onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
            </div>
            <button type="button" onClick={load} disabled={loading}
              className="h-10 bg-white border border-blue-200 text-blue-700 font-semibold rounded-xl text-sm hover:bg-blue-50 transition-colors disabled:opacity-60">
              {loading ? t('common.loading') : t('reports.apply')}
            </button>
          </div>
        </div>

        {/* Five summary stat cards (patients seen, consultations, wait, entries, peak) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-5">
          {summaryCards.map(([label, value]) => (
            <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 border-l-4 border-l-amber-400">
              <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">{label}</div>
              <div className="text-2xl font-bold text-blue-900">{value}</div>
            </div>
          ))}
        </div>

        {/* Charts row 1: queue entries + avg wait per clinic, busiest hours */}
        <div className="grid grid-cols-1 xl:grid-cols-[4fr_3fr] gap-5 mb-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="text-base font-bold text-blue-900 mb-4">{t('reports.queueByClinic')}</div>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={performance} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFF6FF" />
                  <XAxis dataKey="clinic" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Bar dataKey="total" fill="#1E3A8A" name={t('reports.queueEntryLabel')} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="wait"  fill="#FBBF24" name={t('reports.avgWaitLabel')}    radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="text-base font-bold text-blue-900 mb-4">{t('reports.peakHours')}</div>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={peakHours} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Bar dataKey="entries" fill="#2563EB" name={t('reports.queueEntries')} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Charts row 2: monthly visit trend + top-10 most visited patients */}
        <div className="grid grid-cols-1 xl:grid-cols-[4fr_3fr] gap-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="text-base font-bold text-blue-900 mb-4">{t('reports.visitTrend')}</div>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={monthlyVisits} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFF6FF" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Line type="monotone" dataKey="visits" stroke="#2563EB" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#FBBF24', stroke: '#2563EB', strokeWidth: 2 }} name={t('reports.visits')} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="text-base font-bold text-blue-900 mb-4">{t('reports.mostVisited')}</div>
            {(patientStats?.mostVisitedPatients || []).length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="text-left text-xs font-bold text-blue-900 uppercase tracking-wide px-3 py-2 border-b border-blue-100">{t('reports.patient')}</th>
                      <th className="text-left text-xs font-bold text-blue-900 uppercase tracking-wide px-3 py-2 border-b border-blue-100">{t('reports.visits')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientStats.mostVisitedPatients.map((patient) => (
                      <tr key={patient._id} className="border-b border-gray-50">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-gray-900">{patient.name}</div>
                          <div className="text-xs text-gray-500">{patient.NIC}</div>
                        </td>
                        <td className="px-3 py-2 font-bold text-blue-900">{patient.visits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="border-2 border-dashed border-blue-100 rounded-xl p-8 text-center text-gray-400 text-sm">{t('reports.noVisits')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
