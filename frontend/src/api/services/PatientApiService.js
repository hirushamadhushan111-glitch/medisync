/**
 * OOP Concept: Inheritance + Polymorphism
 *
 * PatientApiService extends BaseApiService.
 * Overrides getAll to return patients array directly (Polymorphism).
 * Adds patient-specific methods: search, getMyProfile, getHistory.
 */

import BaseApiService from '../BaseApiService';
import api from '../axiosInstance';

class PatientApiService extends BaseApiService {
  // Base path /patients.
  constructor() {
    super('/patients');
  }

  // Polymorphism: override getAll to unwrap response
  async getAll() {
    const { data } = await api.get('/patients');
    return data.patients || [];
  }

  // GET /patients/search — name / NIC / phone search.
  async search(term) {
    const { data } = await api.get(`/patients/search?q=${encodeURIComponent(term)}`);
    return data.patients || [];
  }

  // GET /patients/me — my patient profile.
  async getMyProfile() {
    const { data } = await api.get('/patients/me');
    return data.patient;
  }

  // GET /patients/:id/history.
  async getHistory(patientId) {
    const { data } = await api.get(`/patients/${patientId}/history`);
    return data;
  }

  // PUT /patients/:id.
  async updatePatient(id, payload) {
    const { data } = await api.put(`/patients/${id}`, payload);
    return data;
  }

  // Register an existing patient to one more clinic (doctor/staff/admin)
  async addToClinic(patientId, clinicId) {
    const { data } = await api.post(`/patients/${patientId}/clinics`, { clinicId });
    return data;
  }
}

export default new PatientApiService();
