/**
 * OOP Concept: Inheritance + Polymorphism
 *
 * ClinicApiService extends BaseApiService.
 * Overrides getAll to unwrap the clinics array (Polymorphism).
 * Encapsulates both the public (/clinics) and admin (/admin/clinics) endpoints.
 */

import BaseApiService from '../BaseApiService';
import api from '../axiosInstance';

class ClinicApiService extends BaseApiService {
  // Base path /clinics.
  constructor() {
    super('/clinics');
  }

  // Polymorphism: override getAll — admin endpoint includes full doctor details
  async getAll() {
    const { data } = await api.get('/admin/clinics');
    return data.clinics || [];
  }

  // Non-admin listing (any authenticated role) — used by staff pages
  async getActive() {
    const { data } = await api.get('/clinics');
    return (data.clinics || []).filter((clinic) => clinic.isActive);
  }

  // GET /clinics/:id.
  async getById(id) {
    const { data } = await api.get(`/clinics/${id}`);
    return data.clinic;
  }

  // Patients registered to a clinic (admin/staff)
  async getPatients(id) {
    const { data } = await api.get(`/clinics/${id}/patients`);
    return data.patients || [];
  }

  // A clinic's appointments for a given day (admin/staff)
  async getAppointments(id, date) {
    const { data } = await api.get(`/clinics/${id}/appointments`, { params: { date } });
    return data.appointments || [];
  }

  // POST /clinics — admin only.
  async create(payload) {
    const { data } = await api.post('/admin/clinics', payload);
    return data;
  }

  // PUT /clinics/:id.
  async update(id, payload) {
    const { data } = await api.put(`/admin/clinics/${id}`, payload);
    return data;
  }

  // DELETE /clinics/:id.
  async remove(id) {
    const { data } = await api.delete(`/admin/clinics/${id}`);
    return data;
  }
}

export default new ClinicApiService();
