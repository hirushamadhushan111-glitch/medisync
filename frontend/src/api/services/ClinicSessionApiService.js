/**
 * OOP Concept: Inheritance + Polymorphism
 *
 * ClinicSessionApiService extends BaseApiService.
 * Adds getUpcoming (patient booking view: today + tomorrow only)
 * and getRange (admin weekly scheduler view).
 */

import BaseApiService from '../BaseApiService';
import api from '../axiosInstance';

class ClinicSessionApiService extends BaseApiService {
  // Base path /clinic-sessions.
  constructor() {
    super('/clinic-sessions');
  }

  // GET /clinic-sessions — admin/staff list.
  async getAll(params = '') {
    const { data } = await api.get(params ? `${this.endpoint}?${params}` : this.endpoint);
    return data.sessions || [];
  }

  // GET sessions within a date range.
  async getRange(from, to) {
    const { data } = await api.get(`${this.endpoint}?from=${from}&to=${to}`);
    return data.sessions || [];
  }

  // GET /clinic-sessions/upcoming — today's + tomorrow's sessions.
  async getUpcoming() {
    const { data } = await api.get(`${this.endpoint}/upcoming`);
    return data.sessions || [];
  }
}

export default new ClinicSessionApiService();
