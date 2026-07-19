/**
 * ClinicContext — the staff/doctor/admin "active clinic" selector.
 *
 * Loads all active clinics after login and remembers the last selected
 * one in localStorage, so pages like Queue Management open on the same
 * clinic next time. Patients don't use this (they see their own clinics).
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { clinicService } from '../api';
import { useAuth } from './AuthContext.jsx';

const ClinicContext = createContext();

// Provider — loads clinics after login, remembers the active one.
export const ClinicProvider = ({ children }) => {
  const { isAuthenticated, role } = useAuth();
  const [clinics, setClinics]           = useState([]);
  const [activeClinic, setActiveClinicState] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || role === 'patient') return;
    clinicService.getAll()
      .then((all) => {
        const active = all.filter((c) => c.isActive);
        setClinics(active);
        const storedId = localStorage.getItem('ms_active_clinic');
        const found = active.find((c) => c._id === storedId) || active[0] || null;
        setActiveClinicState(found);
      })
      .catch(() => {});
  }, [isAuthenticated, role]);

  // Change the active clinic (persisted in localStorage).
  const setActiveClinic = (clinic) => {
    setActiveClinicState(clinic);
    if (clinic) localStorage.setItem('ms_active_clinic', clinic._id);
  };

  return (
    <ClinicContext.Provider value={{ clinics, activeClinic, setActiveClinic }}>
      {children}
    </ClinicContext.Provider>
  );
};

// Hook: clinics + active clinic anywhere.
export const useClinic = () => useContext(ClinicContext);
