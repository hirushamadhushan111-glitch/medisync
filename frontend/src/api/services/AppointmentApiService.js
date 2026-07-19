/**
 * OOP Concept: Inheritance + Polymorphism
 *
 * AppointmentApiService extends BaseApiService.
 * Overrides create to map to 'book' semantics (Polymorphism).
 * Adds appointment-specific methods: getMyAppointments, cancel.
 */

import BaseApiService from '../BaseApiService';
import api from '../axiosInstance';

class AppointmentApiService extends BaseApiService {
  // Base path /appointments.
  constructor() {
    super('/appointments');
  }

  // Optional params, e.g. { date: 'YYYY-MM-DD' } → only that day's appointments
  async getAll(params = {}) {
    const { data } = await api.get('/appointments', { params });
    return data.appointments || [];
  }

  // GET /appointments/my — the logged-in patient's bookings.
  async getMyAppointments() {
    const { data } = await api.get('/appointments/my');
    return data.appointments || [];
  }

  // Polymorphism: override create for appointment booking semantics
  async create(payload) {
    const { data } = await api.post('/appointments', payload);
    return data; // { appointment, queue }
  }

  // PUT /appointments/:id — change status.
  async updateStatus(id, status) {
    const { data } = await api.put(`/appointments/${id}`, { status });
    return data;
  }

  // DELETE /appointments/:id — cancel a booking.
  async cancel(id) {
    const { data } = await api.delete(`/appointments/${id}`);
    return data;
  }
}

export default new AppointmentApiService();
