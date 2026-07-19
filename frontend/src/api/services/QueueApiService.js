/**
 * OOP Concept: Inheritance + Encapsulation
 *
 * QueueApiService extends BaseApiService.
 * Encapsulates all queue lifecycle operations:
 * live view, token creation, call-next, skip, complete, status check.
 */

import BaseApiService from '../BaseApiService';
import api from '../axiosInstance';

class QueueApiService extends BaseApiService {
  // Base path /queue.
  constructor() {
    super('/queue');
  }

  // GET /queue/live/:clinicId — the live queue.
  async getLive(clinicId) {
    const { data } = await api.get(`/queue/live/${clinicId}`);
    return data.queue || [];
  }

  // POST /queue/generate — issue a token (staff).
  async createToken(payload) {
    const { data } = await api.post('/queue/generate', payload);
    return data;
  }

  // GET /queue/my — my token + position.
  async getMyQueue(queueId) {
    const { data } = await api.get(queueId ? `/queue/my?queueId=${queueId}` : '/queue/my');
    return data;
  }

  // PUT /queue/next/:clinicId — doctor calls the next patient.
  async callNext(clinicId) {
    const { data } = await api.put(`/queue/next/${clinicId}`);
    return data;
  }

  // Mark a token skipped.
  async skip(queueId) {
    const { data } = await api.put(`/queue/skip/${queueId}`);
    return data;
  }

  // Mark a token completed.
  async complete(queueId) {
    const { data } = await api.put(`/queue/complete/${queueId}`);
    return data;
  }

  // Queue status for one appointment.
  async getStatus(appointmentId) {
    const { data } = await api.get(`/queue/status/${appointmentId}`);
    return data;
  }

  // GET /queue/public/:clinicId — TV display data.
  async getPublic(clinicId) {
    const { data } = await api.get(`/queue/public/${clinicId}`);
    return data;
  }
}

export default new QueueApiService();
