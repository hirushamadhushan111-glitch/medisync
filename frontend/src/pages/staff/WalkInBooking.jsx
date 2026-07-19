/**
 * WalkInBooking.jsx — staff page for booking a walk-in patient.
 * Find the patient by NIC/phone, pick one of TODAY's still-open clinic
 * sessions, and confirm — the queue token is issued automatically and a
 * confirmation card (token number, wait estimate) is shown.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, UserCheck, Ticket, Users, Clock, Mail, RotateCcw, X } from 'lucide-react';
import { patientService, appointmentService, clinicSessionService } from '../../api';
import { clinicDisplayName } from '../../utils/clinicTypes';
import { withDrPrefix } from '../../utils/names';
import Toast from '../../components/Toast.jsx';

const inputClass = 'w-full h-10 border border-gray-200 rounded-xl px-4 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';

// Is the given date today (ignoring the time part)?
const isToday = (dateValue) => {
  const d = new Date(dateValue); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
};

// Current time as 'HH:mm' for closed-session checks.
const nowHHmm = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

// Page component.
const WalkInBooking = () => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [patient, setPatient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  // Today's sessions that haven't ended yet.
  const loadSessions = async () => {
    const all = await clinicSessionService.getUpcoming();
    // Walk-ins are for today only, and only for sessions that haven't ended yet
    setSessions(all.filter((s) => isToday(s.date) && s.endTime > nowHHmm()));
  };

  useEffect(() => {
    loadSessions().catch((err) => setError(err.response?.data?.message || t('common.error')));
  }, []);

  // Find the patient by NIC or phone.
  const searchPatient = async (event) => {
    event.preventDefault();
    setError(''); setSearched(false);
    const term = searchTerm.trim();
    if (term.length < 2) { setError(t('walkInBooking.searchTooShort')); return; }
    try {
      const results = await patientService.search(term);
      setSearchResults(results);
      setSearched(true);
      // Exactly one match — auto-fill the patient
      if (results.length === 1) { setPatient(results[0]); setSearchResults([]); }
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    }
  };

  // Reset the chosen patient.
  const clearPatient = () => {
    setPatient(null); setSearchResults([]); setSearched(false); setSearchTerm('');
  };

  // Book the walk-in and show the token confirmation.
  const submit = async () => {
    setError(''); setConfirmation(null);
    if (!patient || !sessionId) { setError(t('walkInBooking.selectBoth')); return; }
    try {
      setLoading(true);
      const data = await appointmentService.create({
        sessionId, patientId: patient._id, bookingType: 'walk-in',
      });
      setConfirmation(data);
      await loadSessions();
    } catch (err) {
      const validationMessage = err.response?.data?.errors?.map((item) => item.message).join(', ');
      setError(validationMessage || err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  // Start over for the next patient.
  const reset = () => {
    setConfirmation(null); clearPatient(); setSessionId('');
  };

  const selectedSession = sessions.find((s) => s._id === sessionId);

  // ── Success view: token + wait info ────────────────────────────
  if (confirmation) {
    const queue = confirmation.queue;
    const ahead = Math.max((queue.position || 1) - 1, 0);
    return (
      <div className="pl-56 pt-16 min-h-screen bg-blue-50">
        <div className="p-6">
          <div className="relative bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-xl mx-auto text-center">
            <button type="button" onClick={reset} title={t('common.close')}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
              <Ticket size={28} />
            </div>
            <div className="text-lg font-bold text-blue-900">{t('walkInBooking.successTitle')}</div>
            <div className="text-sm text-gray-500 mt-1">
              {confirmation.appointment?.patientId?.userId?.name || patient?.userId?.name}
              {selectedSession && <> · {clinicDisplayName(selectedSession.clinicId, t)}</>}
            </div>

            <div className="my-6">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('walkInBooking.queueNumber')}</div>
              <div className="text-6xl font-extrabold text-blue-900">#{queue.queueNumber}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center justify-center gap-1.5 text-blue-700 mb-1"><Users size={15} /></div>
                <div className="text-2xl font-bold text-blue-900">{ahead}</div>
                <div className="text-xs text-gray-500">{t('walkInBooking.patientsAhead')}</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-4">
                <div className="flex items-center justify-center gap-1.5 text-amber-600 mb-1"><Clock size={15} /></div>
                <div className="text-2xl font-bold text-blue-900">~{queue.estimatedWaitTime} {t('queueStatus.min')}</div>
                <div className="text-xs text-gray-500">{t('walkInBooking.estWait')}</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-green-700 bg-green-50 rounded-xl p-3 mb-6">
              <Mail size={13} /> {t('walkInBooking.emailSent')}
            </div>

            <button type="button" onClick={reset}
              className="h-11 px-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors inline-flex items-center gap-2">
              <RotateCcw size={15} /> {t('walkInBooking.bookAnother')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-900">{t('walkInBooking.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('walkInBooking.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-3xl">
          <Toast error={error} onClearError={() => setError('')} />

          {/* ── Step 1: Find patient by NIC ─────────────────────── */}
          <div className="text-sm font-bold text-blue-900 mb-2">1. {t('walkInBooking.findPatient')}</div>

          {patient ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <UserCheck size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{patient.userId?.name}</div>
                  <div className="text-xs text-gray-500">{patient.NIC} · {patient.userId?.phone}</div>
                </div>
              </div>
              <button type="button" onClick={clearPatient}
                className="text-xs border border-gray-200 text-gray-600 hover:bg-white rounded-lg px-3 py-1.5 font-semibold transition-colors">
                {t('walkInBooking.change')}
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <form className="flex gap-3" onSubmit={searchPatient}>
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className={`${inputClass} pl-9`} placeholder={t('walkInBooking.searchPlaceholder')}
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus />
                </div>
                <button type="submit" className="px-5 h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors">
                  {t('walkInBooking.search')}
                </button>
              </form>

              {searched && searchResults.length === 0 && (
                <div className="text-xs text-gray-500 bg-blue-50 rounded-xl p-3 mt-3">
                  {t('walkInBooking.noPatientFound')}
                </div>
              )}
              {searchResults.length > 1 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-gray-400">{t('walkInBooking.multipleFound')}</div>
                  {searchResults.map((p) => (
                    <button type="button" key={p._id} onClick={() => { setPatient(p); setSearchResults([]); }}
                      className="w-full flex items-center justify-between border border-gray-100 hover:border-blue-300 hover:bg-blue-50 rounded-xl p-3 text-left transition-colors">
                      <span className="text-sm font-semibold text-gray-900">{p.userId?.name}</span>
                      <span className="text-xs text-gray-500">{p.NIC} · {p.userId?.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Pick one of today's clinics ─────────────── */}
          <div className="text-sm font-bold text-blue-900 mb-2">2. {t('walkInBooking.todaysClinics')}</div>
          {sessions.length === 0 ? (
            <div className="text-sm text-gray-400 bg-blue-50 rounded-xl p-6 text-center mb-6">
              {t('walkInBooking.noClinicsToday')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {sessions.map((session) => {
                const selected = session._id === sessionId;
                return (
                  <button type="button" key={session._id} onClick={() => setSessionId(session._id)}
                    className={`text-left rounded-xl border p-4 transition-all ${selected
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-100 hover:border-blue-300 hover:bg-blue-50/50'}`}>
                    <div className="text-sm font-bold text-blue-900">{clinicDisplayName(session.clinicId, t)}</div>
                    <div className="text-xs text-gray-600 mt-1">{withDrPrefix(session.doctorId?.userId?.name)}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={11} /> {session.startTime} – {session.endTime}
                      </span>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                        {session.bookedCount ?? 0} {t('walkInBooking.inQueue')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <button type="button" onClick={submit} disabled={loading || !patient || !sessionId}
            className="h-11 px-8 bg-amber-400 hover:bg-amber-500 text-blue-900 font-bold rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? t('walkInBooking.booking') : t('walkInBooking.bookBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalkInBooking;
