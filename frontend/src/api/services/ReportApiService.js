/**
 * OOP Concept: Inheritance + Encapsulation
 *
 * ReportApiService extends BaseApiService.
 * Encapsulates all analytics and report export API calls.
 * _buildParams is a private helper (Encapsulation) for constructing query strings.
 */

import BaseApiService from '../BaseApiService';
import api from '../axiosInstance';

class ReportApiService extends BaseApiService {
  // Base path /reports.
  constructor() {
    super('/reports');
  }

  // ── Private query-builder (Encapsulation) ─────────────────────
  _buildParams(filters = {}) {
    return new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
  }

  // GET /reports/daily.
  async getDailySummary(date) {
    const { data } = await api.get(`/reports/daily${date ? `?date=${date}` : ''}`);
    return data.summary;
  }

  // GET /reports/queue-performance.
  async getQueuePerformance(filters = {}) {
    const { data } = await api.get(`/reports/queue-performance?${this._buildParams(filters)}`);
    return data;
  }

  // GET /reports/patient-stats.
  async getPatientStats(filters = {}) {
    const { data } = await api.get(`/reports/patient-stats?${this._buildParams(filters)}`);
    return data;
  }

  // URL of the PDF export endpoint.
  exportPdfUrl(filters = {}) {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    return `${base}/reports/export-pdf?${this._buildParams(filters)}`;
  }
}

export default new ReportApiService();
