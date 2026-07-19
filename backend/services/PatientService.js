/**
 * OOP Concept: Inheritance + Polymorphism
 *
 * PatientService extends BaseService.
 * Overrides findAll to always populate userId (user details).
 * Adds patient-specific methods: search, getByUserId.
 */

const BaseService  = require('./BaseService');
const Patient      = require('../models/Patient');
const { NotFoundError } = require('../utils/AppError');

class PatientService extends BaseService {
  // Bind this service to the Patient model (BaseService provides shared CRUD).
  constructor() {
    super(Patient, 'Patient');
  }

  // ── Polymorphism: override findAll to include user details ────
  async findAll(filter = {}, options = {}) {
    return super.findAll(filter, {
      ...options,
      populate: [{ path: 'userId' }, { path: 'registeredClinics' }],
    });
  }

  // ── Find patient by their User ID ─────────────────────────────
  async findByUserId(userId) {
    const patient = await Patient.findOne({ userId })
      .populate('userId')
      .populate('registeredClinics');
    if (!patient) throw new NotFoundError('Patient profile');
    return patient;
  }

  // ── Search patients by name, NIC, or phone ────────────────────
  // registeredClinics is populated so every consumer (navbar, staff
  // dashboard, consultation, reports) can show which clinics the
  // patient belongs to — patients may be in several clinics at once.
  async search(query) {
    if (!query || query.trim().length < 2) return [];

    const patients = await Patient.find()
      .populate({
        path: 'userId',
        match: {
          $or: [
            { name:  { $regex: query, $options: 'i' } },
            { NIC:   { $regex: query, $options: 'i' } },
            { phone: { $regex: query, $options: 'i' } },
          ],
        },
      })
      .populate('registeredClinics', 'clinicName departmentType');

    return patients.filter((p) => p.userId !== null);
  }

  // ── Get patient with full profile ─────────────────────────────
  async getFullProfile(patientId) {
    const patient = await Patient.findById(patientId)
      .populate('userId')
      .populate('registeredClinics', 'clinicName departmentType');
    if (!patient) throw new NotFoundError('Patient');
    return patient;
  }
}

module.exports = new PatientService();
