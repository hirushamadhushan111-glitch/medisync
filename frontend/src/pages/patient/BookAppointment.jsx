/**
 * BookAppointment.jsx — patient booking page (session cards).
 *
 * Patients see today's and tomorrow's ClinicSessions ONLY for clinics
 * they are registered in, pick a card, and confirm — the queue number
 * is issued automatically. A today-session that has already ended shows
 * as "Closed" and cannot be selected.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Clock, Stethoscope, Users, CheckCircle2 } from 'lucide-react';
import { clinicSessionService, appointmentService } from '../../api';
import { clinicDisplayName, clinicTypeLabel } from '../../utils/clinicTypes';
import { withDrPrefix } from '../../utils/names';
import Toast from '../../components/Toast.jsx';

// Date → 'YYYY-MM-DD' (local time, no timezone shift).
const toDateStr = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Current time as 'HH:mm' for closed-session checks.
const nowHHmm = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

// One selectable clinic-session card (clinic, doctor, time, booked count).
const SessionCard = ({ session, isToday, selected, onSelect, t }) => {
  const closed = isToday && nowHHmm() >= session.endTime; // session already over today
  const clinic = session.clinicId;
  const doctorName = session.doctorId?.userId?.name;

  return (
    <button
      type="button"
      disabled={closed}
      onClick={(event) => { event.stopPropagation(); onSelect(session._id); }}
      className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
        closed
          ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
          : selected
            ? 'border-blue-600 bg-blue-50 shadow-md'
            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm cursor-pointer'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-blue-900 text-sm truncate">{clinicDisplayName(clinic, t)}</div>
          <div className="text-xs text-blue-600 font-medium mt-0.5">{clinicTypeLabel(clinic?.departmentType, t)}</div>
        </div>
        {closed ? (
          <span className="text-[10px] font-bold bg-gray-200 text-gray-500 rounded-full px-2 py-0.5 flex-shrink-0">
            {t('bookAppointment.closed')}
          </span>
        ) : selected ? (
          <CheckCircle2 size={20} className="text-blue-600 flex-shrink-0" />
        ) : null}
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Stethoscope size={13} className="text-gray-400 flex-shrink-0" />
          <span className="truncate">{withDrPrefix(doctorName)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Clock size={13} className="text-gray-400 flex-shrink-0" />
          <span>{session.startTime} – {session.endTime}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Users size={13} className="text-gray-400 flex-shrink-0" />
          <span>{session.bookedCount ?? 0} {t('bookAppointment.patientsBooked')}</span>
        </div>
      </div>
    </button>
  );
};

// Page component.
const BookAppointment = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language === 'si' ? 'si-LK' : 'en-US';

  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');

  // Fetch today's/tomorrow's bookable sessions.
  const load = async () => {
    setLoading(true);
    try {
      const sessions = await clinicSessionService.getUpcoming();
      setSessions(sessions);
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayStr = toDateStr(today);

  const { todaySessions, tomorrowSessions } = useMemo(() => {
    const todayList = [];
    const tomorrowList = [];
    sessions.forEach((session) => {
      if (toDateStr(new Date(session.date)) === todayStr) todayList.push(session);
      else tomorrowList.push(session);
    });
    return { todaySessions: todayList, tomorrowSessions: tomorrowList };
  }, [sessions, todayStr]);

  // Book the selected session and show the confirmation.
  const submit = async () => {
    if (!selectedId) return;
    setError('');
    try {
      setBooking(true);
      const data = await appointmentService.create({ sessionId: selectedId, bookingType: 'online' });
      setConfirmation(data);
      setSelectedId('');
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setBooking(false);
    }
  };

  // Localised heading line for a day group.
  const dateLine = (offsetDays) => {
    const date = new Date(today);
    date.setDate(date.getDate() + offsetDays);
    return date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
  };

  // Render one day's session cards.
  const renderGroup = (label, dateStrLine, groupSessions, isToday, emptyKey) => (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-lg font-bold text-blue-900">{label}</h2>
        <span className="text-xs text-gray-400">{dateStrLine}</span>
      </div>
      {groupSessions.length === 0 ? (
        <div className="border-2 border-dashed border-blue-100 rounded-2xl p-6 text-center text-gray-400 text-sm bg-white/50">
          {t(emptyKey)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groupSessions.map((session) => (
            <SessionCard key={session._id} session={session} isToday={isToday}
              selected={selectedId === session._id} onSelect={setSelectedId} t={t} />
          ))}
        </div>
      )}
    </div>
  );

  if (confirmation) {
    return (
      <div className="pl-56 pt-16 min-h-screen bg-blue-50">
        <div className="p-6 flex justify-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center mt-8">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={30} className="text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-blue-900">{t('bookAppointment.successTitle')}</h1>
            <div className="mt-6 bg-blue-50 rounded-2xl p-6">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('bookAppointment.yourQueueNumber')}</div>
              <div className="text-5xl font-extrabold text-blue-900 mt-1">#{confirmation.queue?.queueNumber}</div>
              <div className="text-sm text-gray-500 mt-2">
                {t('bookAppointment.estWait')} <strong>{confirmation.queue?.estimatedWaitTime} {t('bookAppointment.min')}</strong>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">{t('bookAppointment.successHint')}</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => { setConfirmation(null); load(); }}
                className="flex-1 h-11 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">
                {t('bookAppointment.bookAnother')}
              </button>
              <button type="button" onClick={() => navigate('/patient/queue')}
                className="flex-1 h-11 bg-amber-400 hover:bg-amber-500 text-blue-900 font-bold rounded-xl text-sm transition-colors">
                {t('bookAppointment.viewQueue')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    // Clicking anywhere outside a session card clears the selection
    <div className="pl-56 pt-16 min-h-screen bg-blue-50" onClick={() => setSelectedId('')}>
      <div className="p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">{t('bookAppointment.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('bookAppointment.subtitle')}</p>
          <p className="text-xs text-blue-600 mt-1.5">{t('bookAppointment.registeredOnlyHint')}</p>
        </div>

        <Toast error={error} onClearError={() => setError('')} />

        {loading ? (
          <div className="text-sm text-gray-400 py-12 text-center">{t('bookAppointment.loading')}</div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-gray-400 text-sm">
            {t('bookAppointment.noSessions')}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-5">{t('bookAppointment.selectPrompt')}</p>
            <div className="space-y-8">
              {renderGroup(t('bookAppointment.today'), dateLine(0), todaySessions, true, 'bookAppointment.noSessionsToday')}
              {renderGroup(t('bookAppointment.tomorrow'), dateLine(1), tomorrowSessions, false, 'bookAppointment.noSessionsTomorrow')}
            </div>

            <div className="sticky bottom-4 mt-8">
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); submit(); }}
                disabled={!selectedId || booking}
                className="w-full h-12 bg-amber-400 hover:bg-amber-500 text-blue-900 font-bold rounded-xl text-sm transition-colors disabled:opacity-50 shadow-lg"
              >
                {booking ? t('bookAppointment.booking') : t('bookAppointment.bookBtn')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BookAppointment;
