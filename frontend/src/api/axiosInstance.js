/**
 * axiosInstance.js — the single axios client used by every API service.
 *
 *  - Request interceptor: attaches the JWT as "Authorization: Bearer …".
 *  - Response interceptor: on any 401 (expired/invalid token) it clears
 *    the session and fires 'medisync-auth-expired' so AuthContext logs
 *    the user out everywhere at once.
 */
import axios from 'axios';
import { getToken, clearSession } from '../utils/authStorage';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Attach the login token to every outgoing request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      window.dispatchEvent(new Event('medisync-auth-expired'));
    }
    return Promise.reject(error);
  }
);

export default api;
