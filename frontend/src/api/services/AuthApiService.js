/**
 * OOP Concept: Inheritance + Encapsulation
 *
 * AuthApiService extends BaseApiService.
 * Encapsulates all authentication and user-profile API calls.
 */

import BaseApiService from '../BaseApiService';
import api from '../axiosInstance';

class AuthApiService extends BaseApiService {
  // Base path /auth.
  constructor() {
    super('/auth');
  }

  // POST /auth/login — sign in, returns token + user.
  async login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  }

  // GET /auth/me — current user (session check).
  async getMe() {
    const { data } = await api.get('/auth/me');
    return data;
  }

  // GET /auth/profile — user + role profile.
  async getProfile() {
    const { data } = await api.get('/auth/profile');
    return data;
  }

  // PUT /auth/profile — save profile changes.
  async updateProfile(payload) {
    const { data } = await api.put('/auth/profile', payload);
    return data;
  }

  // POST /auth/create-user — staff/admin create an account.
  async createUser(payload) {
    const { data } = await api.post('/auth/create-user', payload);
    return data;
  }

  // Polymorphism: override create to use the correct endpoint
  async create(payload) {
    return this.createUser(payload);
  }

  // POST /auth/avatar — profile picture upload.
  async uploadAvatar(formData) {
    const { data } = await api.post('/auth/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }
}

export default new AuthApiService();
