/**
 * PublicQueueDisplay.jsx — the waiting-room TV screen (no login).
 *
 * Uses plain axios (not the authed api client) against the public queue
 * endpoints and polls every few seconds. Shows only token numbers and
 * statuses — no patient personal data. ?clinicId= picks the clinic.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { clinicDisplayName, clinicTypeLabel } from '../../utils/clinicTypes';
import { withDrPrefix } from '../../utils/names';
import Logo from '../../components/Logo.jsx';

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Page component (public — no login).
const PublicQueueDisplay = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clinics, setClinics] = useState([]);
  const [clinicId, setClinicId] = useState(searchParams.get('clinicId') || '');
  const [display, setDisplay] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${apiBase}/queue/public-clinics`)
      .then(({ data }) => {
        // Only active clinics are listed on the display.
        const active = (data.clinics || []).filter((clinic) => clinic.isActive);
        setClinics(active);
        if (!clinicId && active[0]) setClinicId(active[0]._id);
      })
      .catch(() => setError('Failed to load clinics.'));
  }, []);

  useEffect(() => {
    if (!clinicId) return undefined;
    // Poll the public queue for the selected clinic.
    const load = () => {
      axios.get(`${apiBase}/queue/public/${clinicId}`)
        .then(({ data }) => setDisplay(data))
        .catch(() => setError('Failed to load queue display.'));
    };
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [clinicId]);

  useEffect(() => {
    if (clinicId) setSearchParams({ clinicId });
  }, [clinicId, setSearchParams]);

  const current = display?.queue?.find((item) => item.status === 'serving');
  const waiting = useMemo(() => (display?.queue || []).filter((item) => item.status === 'waiting').slice(0, 5), [display]);

  return (
    <div className="min-h-screen bg-blue-900 text-white">
      <div className="p-8">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-start gap-4 mb-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/95 shadow-lg flex items-center justify-center flex-shrink-0">
              <Logo size={36} />
            </div>
            <div>
              <div className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">MediSync Live Queue</div>
              <h1 className="text-4xl font-bold text-white">{display?.clinicName ? clinicDisplayName(display.clinicName, t) : 'OPD Queue Display'}</h1>
              <p className="text-blue-300 text-sm mt-1">{display?.departmentType ? clinicTypeLabel(display.departmentType, t) : 'Waiting area monitor'}</p>
            </div>
          </div>
          <select className="h-10 border border-blue-700 bg-blue-800 text-white rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-amber-400"
            value={clinicId} onChange={(event) => setClinicId(event.target.value)}>
            {clinics.map((clinic) => <option key={clinic._id} value={clinic._id}>{clinicDisplayName(clinic, t)}</option>)}
          </select>
        </div>

        {error && <div className="bg-red-900/30 border border-red-500/30 text-red-300 rounded-xl p-3 text-sm mb-6">{error}</div>}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Now serving */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
            <div className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-6">Now Serving</div>
            <div className="text-[120px] font-extrabold text-amber-400 leading-none mb-6">
              #{current?.queueNumber || '--'}
            </div>
            <div className="text-blue-200 text-xl">
              {withDrPrefix(current?.doctorName) || 'Please wait'}
            </div>
          </div>

          {/* Next numbers */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-10">
            <div className="text-blue-300 text-sm font-semibold uppercase tracking-widest mb-8">Next Numbers</div>
            {waiting.length ? (
              <div className="space-y-4">
                {waiting.map((item) => (
                  <div key={item.queueNumber} className="bg-white/10 rounded-2xl px-6 py-4 text-center">
                    <span className="text-4xl font-bold text-white">#{item.queueNumber}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-blue-400 text-lg text-center py-10">--</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicQueueDisplay;
