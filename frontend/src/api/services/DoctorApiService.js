/**
 * OOP Concept: Inheritance + Polymorphism
 *
 * DoctorApiService extends BaseApiService.
 * Overrides getAll to unwrap the doctors array (Polymorphism).
 * Adds doctor-specific methods: getMyProfile, updateAvailability,
 * and full medical record CRUD.
 */

import BaseApiService from '../BaseApiService';
import api from '../axiosInstance';

class DoctorApiService extends BaseApiService {
  // Base path /doctors.
  constructor() {
    super('/doctors');
  }

  // Polymorphism: override getAll to unwrap response
  async getAll() {
    const { data } = await api.get('/doctors');
    return data.doctors || [];
  }

  // GET /doctors/me — my doctor profile + clinics.
  async getMyProfile() {
    const { data } = await api.get('/doctors/me');
    return data; // { doctor, clinics }
  }

  // PATCH /doctors/me/availability.
  async updateAvailability(isAvailable) {
    const { data } = await api.patch('/doctors/me/availability', { isAvailable });
    return data;
  }

  // GET /doctors/:id/patients.
  async getDoctorPatients(doctorId) {
    const { data } = await api.get(`/doctors/${doctorId}/patients`);
    return data.patients || [];
  }

  // ── Medical record methods ────────────────────────────────────
  async addRecord(payload) {
    const { data } = await api.post('/records', payload);
    return data;
  }

  // GET /records/patient/:id — consultation records.
  async getRecordsForPatient(patientId) {
    const { data } = await api.get(`/records/patient/${patientId}`);
    return data.records || [];
  }

  // GET /records/:id.
  async getRecordById(recordId) {
    const { data } = await api.get(`/records/${recordId}`);
    return data.record;
  }

  // PUT /records/:id.
  async updateRecord(recordId, payload) {
    const { data } = await api.put(`/records/${recordId}`, payload);
    return data;
  }

  // GET /records/:id/prescription-pdf — triggers the download.
  async downloadPrescriptionPdf(recordId) {
    const response = await api.get(`/records/${recordId}/prescription-pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `prescription-${recordId}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // GET /records/patient/:id/history-pdf — triggers the download.
  async downloadHistoryPdf(patientId, patientName = 'patient') {
    const response = await api.get(`/records/patient/${patientId}/history-pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `medical-history-${patientName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

export default new DoctorApiService();
