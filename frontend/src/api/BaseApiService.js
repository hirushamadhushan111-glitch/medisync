/**
 * OOP Concept: Abstraction + Encapsulation
 *
 * BaseApiService is an abstract base class that encapsulates
 * common HTTP CRUD operations for any REST resource.
 * Subclasses inherit these methods and can override them
 * (Polymorphism) to add resource-specific behaviour.
 *
 * This mirrors the Repository / Service pattern used in the backend.
 */

import api from './axiosInstance';

class BaseApiService {
  /**
   * @param {string} endpoint - Base API path (e.g. '/patients')
   */
  constructor(endpoint) {
    if (new.target === BaseApiService) {
      throw new Error('BaseApiService is abstract and cannot be instantiated directly.');
    }
    this.endpoint = endpoint; // Encapsulated — only accessible within the class hierarchy
  }

  // ── READ ALL ──────────────────────────────────────────────────
  async getAll(params = '') {
    const url = params ? `${this.endpoint}?${params}` : this.endpoint;
    const { data } = await api.get(url);
    return data;
  }

  // ── READ ONE ──────────────────────────────────────────────────
  async getById(id) {
    const { data } = await api.get(`${this.endpoint}/${id}`);
    return data;
  }

  // ── CREATE ────────────────────────────────────────────────────
  async create(payload) {
    const { data } = await api.post(this.endpoint, payload);
    return data;
  }

  // ── UPDATE ────────────────────────────────────────────────────
  async update(id, payload) {
    const { data } = await api.put(`${this.endpoint}/${id}`, payload);
    return data;
  }

  // ── DELETE ────────────────────────────────────────────────────
  async remove(id) {
    const { data } = await api.delete(`${this.endpoint}/${id}`);
    return data;
  }
}

export default BaseApiService;
