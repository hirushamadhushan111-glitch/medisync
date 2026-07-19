/**
 * OOP Concept: Inheritance + Polymorphism
 *
 * MedicalReportApiService extends BaseApiService.
 * Overrides create to handle multipart file upload (Polymorphism).
 * Adds patient-scoped and self-scoped report queries.
 */

import BaseApiService from '../BaseApiService';
import api from '../axiosInstance';

class MedicalReportApiService extends BaseApiService {
  // Base path /medical-reports.
  constructor() {
    super('/medical-reports');
  }

  // GET /medical-reports/my — my lab reports.
  async getMyReports(type) {
    const url = type ? `/medical-reports/my?type=${type}` : '/medical-reports/my';
    const { data } = await api.get(url);
    return data.reports || [];
  }

  // GET /medical-reports/patient/:id.
  async getByPatient(patientId, type) {
    const url = type
      ? `/medical-reports/patient/${patientId}?type=${type}`
      : `/medical-reports/patient/${patientId}`;
    const { data } = await api.get(url);
    return data.reports || [];
  }

  // Polymorphism: override create to send multipart/form-data
  async create(formData) {
    const { data } = await api.post('/medical-reports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  // DELETE /medical-reports/:id.
  async remove(id) {
    const { data } = await api.delete(`/medical-reports/${id}`);
    return data;
  }
}

export default new MedicalReportApiService();
