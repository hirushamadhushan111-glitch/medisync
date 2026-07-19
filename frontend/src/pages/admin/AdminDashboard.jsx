/**
 * AdminDashboard.jsx — the admin home page.
 * System-wide stat cards plus recharts graphs (weekly appointments,
 * status donut, queue performance) and today's appointment list.
 */
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Users, CalendarCheck, ListChecks, Stethoscope, Clock, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { adminService, reportService, appointmentService } from '../../api';
import { withDrPrefix } from '../../utils/names';
import Toast from '../../components/Toast.jsx';

// Date → 'YYYY-MM-DD' for API query params.
const isoDate = (date) => date.toISOString().slice(0, 10);

const DONUT_COLORS = ['#34D399', '#60A5FA', '#FBBF24', '#F87171'];

const STATUS_STYLES = {
  confirmed:  'bg-green-100 text-green-700',
  pending:    'bg-amber-100 text-amber-700',
  cancelled:  'bg-red-100 text-red-700',
  completed:  'bg-blue-100 text-blue-700',
};

// One coloured stat tile (label + value + icon).
const StatCard = ({ label, value, icon: Icon, iconBg, iconColor, accent }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 ${accent ? 'border-l-4 border-l-amber-400' : ''}`}>
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
      <Icon size={22} color={iconColor || '#fff'} />
    </div>
    <div>
      <div className="text-3xl font-bold text-blue-900 leading-none">{value}</div>
      <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-1">{label}</div>
    </div>
  </div>
);

// White card wrapper that titles a chart.
const ChartCard = ({ title, subtitle, children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
    <div className="mb-4">
      <div className="text-base font-bold text-blue-900">{title}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
    </div>
    {children}
  </div>
);

// Page component — loads stats + charts on mount.
const AdminDashboard = () => {
  const { t } = useTranslation();
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 29);

  const [stats, setStats] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [daily, setDaily] = useState(null);
  const [visitTrend, setVisitTrend] = useState([]);
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch stats, weekly data and today's appointments in parallel.
    const load = async () => {
      const range = { start: isoDate(monthAgo), end: isoDate(today) };
      const [stats, queueData, dailyData, patientData] = await Promise.all([
        adminService.getDashboardStats(),
        reportService.getQueuePerformance(range),
        reportService.getDailySummary(isoDate(today)),
        reportService.getPatientStats(range),
      ]);
      setStats(stats);
      setPerformance(
        (queueData.performance || []).map((item) => ({
          clinic: item.clinic?.clinicName?.slice(0, 12) || 'Clinic',
          tokens: item.totalTokens,
          completed: item.completed,
        }))
      );
      setDaily(dailyData);
      setVisitTrend(
        (patientData.stats?.monthlyVisits || patientData.monthlyVisits || []).map((v) => ({
          month: `${String(v._id?.month ?? '').padStart(2, '0')}/${String(v._id?.year ?? '').slice(-2)}`,
          visits: v.count ?? 0,
        }))
      );
      try {
        const appointments = await appointmentService.getAll();
        setRecentAppointments(appointments.slice(0, 6));
      } catch { /* silent */ }
    };
    load().catch((err) => setError(err.response?.data?.message || t('adminDashboard.failedLoad')));
  }, []);

  // Data for the four big stat cards at the top of the page.
  const statCards = [
    { label: t('adminDashboard.totalPatients'),      value: stats?.totalPatients ?? '—',      icon: Users,        iconBg: '#1E3A8A' },
    { label: t('adminDashboard.todayAppointments'),  value: stats?.todaysAppointments ?? '—', icon: CalendarCheck, iconBg: '#FBBF24', iconColor: '#1E3A8A', accent: true },
    { label: t('adminDashboard.activeQueues'),       value: stats?.activeQueues ?? '—',       icon: ListChecks,    iconBg: '#2563EB' },
    { label: t('adminDashboard.registeredDoctors'),  value: stats?.registeredDoctors ?? '—',  icon: Stethoscope,   iconBg: '#1D4ED8' },
  ];

  const dailyItems = daily ? [
    { label: t('adminDashboard.patientsSeen'),      value: daily.uniquePatientsSeen ?? 0, icon: Users,        color: 'text-blue-700',   bg: 'bg-blue-50'   },
    { label: t('adminDashboard.completedEntries'),  value: daily.completed ?? 0,          icon: CheckCircle,  color: 'text-green-700',  bg: 'bg-green-50'  },
    { label: t('adminDashboard.currentlyWaiting'),  value: daily.waiting ?? 0,            icon: Clock,        color: 'text-amber-700',  bg: 'bg-amber-50'  },
    { label: t('adminDashboard.appointmentsToday'), value: daily.appointments ?? 0,       icon: AlertCircle,  color: 'text-purple-700', bg: 'bg-purple-50' },
  ] : [];

  // Today's queue split by status — feeds the donut chart.
  const donutData = daily ? [
    { name: t('adminDashboard.completed'), value: daily.completed || 0 },
    { name: t('adminDashboard.waiting'),   value: daily.waiting   || 0 },
    { name: t('adminDashboard.serving'),   value: daily.serving   || 0 },
    { name: t('adminDashboard.skipped'),   value: daily.skipped   || 0 },
  ] : [];
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">{t('adminDashboard.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('adminDashboard.subtitle')}</p>
        </div>

        <Toast error={error} onClearError={() => setError('')} />

        {/* Top stat cards: patients / today's appointments / queues / doctors */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          {statCards.map((card) => <StatCard key={card.label} {...card} />)}
        </div>

        {/* Second row: today's numbers (seen, completed, waiting, appointments) */}
        {daily && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {dailyItems.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                  <Icon size={18} className={color} />
                </div>
                <div>
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide font-semibold leading-tight">{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Charts row 1: per-clinic bar chart + today's status donut */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 mb-4">
          <ChartCard title={t('adminDashboard.queuePerformance')} subtitle={t('adminDashboard.queuePerformanceSubtitle')}>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={performance} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="clinic" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} cursor={{ fill: '#EFF6FF' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="tokens"    fill="#93C5FD" name={t('adminDashboard.tokens')}    radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="completed" fill="#1E3A8A" name={t('adminDashboard.completed')} radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title={t('adminDashboard.queueStatus')} subtitle={t('adminDashboard.queueStatusSubtitle')}>
            <div className="flex flex-col items-center">
              <div className="h-52 w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={donutTotal > 0 ? donutData : [{ name: t('adminDashboard.noData'), value: 1 }]}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={85}
                      paddingAngle={donutTotal > 0 ? 3 : 0}
                      dataKey="value" stroke="none"
                    >
                      {donutTotal > 0
                        ? donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)
                        : <Cell fill="#E2E8F0" />}
                    </Pie>
                    {donutTotal > 0 && <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />}
                    {donutTotal > 0 && <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle" fill="#1E3A8A" style={{ fontSize: 26, fontWeight: 700 }}>{donutTotal}</text>}
                    {donutTotal > 0 && <text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle" fill="#9CA3AF" style={{ fontSize: 11 }}>{t('adminDashboard.totalToday')}</text>}
                    {donutTotal === 0 && <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#9CA3AF" style={{ fontSize: 12 }}>{t('adminDashboard.noData')}</text>}
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full mt-1">
                {donutData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i] }} />
                    <span className="text-xs text-gray-600">{item.name}</span>
                    <span className="text-xs font-bold text-gray-800 ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Charts row 2: monthly visit trend line + recent appointments table */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
          <ChartCard title={t('adminDashboard.visitTrend')} subtitle={t('adminDashboard.visitTrendSubtitle')}>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={visitTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Line type="monotone" dataKey="visits" stroke="#34D399" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#fff', stroke: '#34D399', strokeWidth: 2.5 }} activeDot={{ r: 6, fill: '#34D399' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title={t('adminDashboard.recentAppointments')} subtitle={t('adminDashboard.recentApptSubtitle')}>
            <div className="overflow-hidden">
              {recentAppointments.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-[10px] font-bold uppercase tracking-wide text-gray-400 pb-2">{t('adminDashboard.patient')}</th>
                      <th className="text-left text-[10px] font-bold uppercase tracking-wide text-gray-400 pb-2">{t('adminDashboard.doctor')}</th>
                      <th className="text-right text-[10px] font-bold uppercase tracking-wide text-gray-400 pb-2">{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentAppointments.slice(0, 6).map((appt) => (
                      <tr key={appt._id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="py-2.5 pr-2 text-gray-800 font-medium truncate max-w-[90px]">
                          {appt.patientId?.userId?.name || appt.patient?.name || t('adminDashboard.patient')}
                        </td>
                        <td className="py-2.5 pr-2 text-gray-500 truncate max-w-[90px]">
                          {withDrPrefix(appt.doctorId?.userId?.name || appt.doctor?.name) || '—'}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${STATUS_STYLES[appt.status] || 'bg-gray-100 text-gray-600'}`}>
                            {appt.status || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <TrendingUp size={28} className="mb-2 opacity-40" />
                  <p className="text-xs">{t('common.noData')}</p>
                </div>
              )}
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
