/**
 * PatientQueue.jsx — doctor's live view of their own queue.
 *
 * Loads the doctor's clinics, lets them pick one, and shows only THEIR
 * tokens (the clinic queue is filtered by doctorId). Updates arrive live
 * through the clinic's Socket.IO room — no refresh needed.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doctorService, queueService } from '../../api';
import { clinicDisplayName } from '../../utils/clinicTypes';
import QueueDisplay from '../../components/QueueDisplay.jsx';
import { useSocket } from '../../context/SocketContext.jsx';

// Page component.
const PatientQueue = () => {
  const { t } = useTranslation();
  const { socket } = useSocket();
  const [doctor, setDoctor] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [clinicId, setClinicId] = useState('');
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    // Load my doctor profile + clinics, then default to the first clinic.
    const load = async () => {
      const data = await doctorService.getMyProfile();
      setDoctor(data.doctor);
      const list = data.clinics || [];
      setClinics(list);
      if (list[0]) setClinicId(list[0]._id);
    };
    load();
  }, []);

  useEffect(() => {
    if (!clinicId || !doctor) return;
    queueService.getLive(clinicId)
      .then((queue) => setQueue(queue.filter((item) => item.doctorId?._id === doctor._id)))
      .catch(() => setQueue([]));
  }, [clinicId, doctor]);

  // Join the clinic's socket room for live queue updates; leave on change.
  useEffect(() => {
    if (!socket || !clinicId || !doctor) return undefined;
    socket.emit('join-clinic', clinicId);
    // Live queue refresh (kept to this doctor's tokens only).
    const handleUpdate = (updatedQueue) => setQueue(updatedQueue.filter((item) => item.doctorId?._id === doctor._id));
    socket.on('queue:updated', handleUpdate);
    return () => { socket.emit('leave-clinic', clinicId); socket.off('queue:updated', handleUpdate); };
  }, [socket, clinicId, doctor]);

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-900">{t('patientQueue.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('patientQueue.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> {t('patientQueue.live')}
            </span>
            <select className="h-10 border border-gray-200 rounded-xl px-3 text-sm bg-blue-50 outline-none focus:ring-2 focus:ring-blue-500"
              value={clinicId} onChange={(event) => setClinicId(event.target.value)}>
              {clinics.map((clinic) => <option key={clinic._id} value={clinic._id}>{clinicDisplayName(clinic, t)}</option>)}
            </select>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <QueueDisplay queue={queue} />
        </div>
      </div>
    </div>
  );
};

export default PatientQueue;
