/**
 * OOP Concept: Inheritance + Encapsulation
 *
 * NotificationApiService extends BaseApiService.
 * Encapsulates notification retrieval and read-status management.
 */

import BaseApiService from '../BaseApiService';
import api from '../axiosInstance';

class NotificationApiService extends BaseApiService {
  // Base path /notifications.
  constructor() {
    super('/notifications');
  }

  // GET /notifications/my.
  async getAll() {
    const { data } = await api.get('/notifications/my');
    return data.notifications || [];
  }

  // PUT /notifications/read/:id.
  async markRead(id) {
    const { data } = await api.put(`/notifications/read/${id}`);
    return data;
  }

  // PUT /notifications/read-all.
  async markAllRead() {
    const { data } = await api.put('/notifications/read-all');
    return data;
  }
}

export default new NotificationApiService();
