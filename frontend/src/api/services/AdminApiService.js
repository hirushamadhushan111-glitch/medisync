/**
 * OOP Concept: Inheritance + Polymorphism
 *
 * AdminApiService extends BaseApiService for admin-only operations.
 * Overrides getAll to return the users list (Polymorphism).
 * Encapsulates user management (CRUD) and dashboard stats.
 */

import BaseApiService from '../BaseApiService';
import api from '../axiosInstance';

class AdminApiService extends BaseApiService {
  // Base path /admin.
  constructor() {
    super('/admin');
  }

  // ── User management ───────────────────────────────────────────
  // Polymorphism: override getAll to list users
  async getAll() {
    const { data } = await api.get('/admin/users');
    return data.users || [];
  }

  // PUT /admin/users/:id — edit a user.
  async updateUser(id, payload) {
    const { data } = await api.put(`/admin/users/${id}`, payload);
    return data;
  }

  // DELETE /admin/users/:id.
  async deleteUser(id) {
    const { data } = await api.delete(`/admin/users/${id}`);
    return data;
  }

  // PUT /admin/staff/:id/clinics — set a staff member's clinics.
  async assignStaffClinics(userId, clinicIds) {
    const { data } = await api.put(`/admin/staff/${userId}/clinics`, { clinicIds });
    return data;
  }

  // ── Dashboard stats ───────────────────────────────────────────
  async getDashboardStats() {
    const { data } = await api.get('/admin/dashboard-stats');
    return data.stats;
  }

  // ── Audit logs ────────────────────────────────────────────────
  async getAuditLogs(params = {}) {
    const { data } = await api.get('/admin/audit-logs', { params });
    return data;
  }

  // ── Roles & permissions (UC20) ────────────────────────────────
  async getRolePermissions() {
    const { data } = await api.get('/admin/roles');
    return data;
  }

  // PUT /admin/roles/:role — save one role's permissions.
  async updateRolePermissions(role, permissions) {
    const { data } = await api.put(`/admin/roles/${role}`, { permissions });
    return data;
  }

  // ── Medical records oversight (UC19) ──────────────────────────
  async getAllRecords(params = {}) {
    const { data } = await api.get('/admin/records', { params });
    return data;
  }

  // PUT /admin/records/:id — correct a medical record.
  async updateRecord(id, payload) {
    const { data } = await api.put(`/admin/records/${id}`, payload);
    return data;
  }

  // DELETE /admin/records/:id.
  async deleteRecord(id) {
    const { data } = await api.delete(`/admin/records/${id}`);
    return data;
  }

  // ── Bulk patient import ───────────────────────────────────────
  async importPatients(file) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/admin/patients/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }
}

export default new AdminApiService();
