/**
 * OOP Concept: Inheritance + Polymorphism + Encapsulation
 *
 * ClinicService extends BaseService.
 * Overrides findAll to deep-populate assigned doctors (Polymorphism).
 * Encapsulates uniqueness checks and soft-delete logic.
 */

const BaseService  = require('./BaseService');
const Clinic       = require('../models/Clinic');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/AppError');

class ClinicService extends BaseService {
  // Bind this service to the Clinic model (BaseService provides shared CRUD).
  constructor() {
    super(Clinic, 'Clinic');
  }

  // ── Polymorphism: override findAll to deep-populate ──────────
  async findAll(filter = {}, options = {}) {
    return Clinic.find(filter)
      .populate({ path: 'assignedDoctors', populate: { path: 'userId', select: '-password' } })
      .sort(options.sort || 'clinicName');
  }

  // ── Private helper — name uniqueness check ───────────────────
  async _assertNameUnique(name, excludeId = null) {
    const query = { clinicName: name };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Clinic.findOne(query);
    if (exists) throw new ConflictError('Clinic name already exists');
  }

  // ── Create with duplicate name guard ─────────────────────────
  async createClinic({ clinicName, departmentType, openingHours, isActive, assignedDoctors } = {}) {
    if (!clinicName || !departmentType) {
      throw new ValidationError('Clinic name and department type are required');
    }
    await this._assertNameUnique(clinicName);

    const clinic = new Clinic({
      clinicName,
      departmentType,
      openingHours,
      isActive: isActive !== undefined ? isActive : true,
      assignedDoctors,
    });
    await clinic.save();
    return clinic.populate('assignedDoctors');
  }

  // ── Update with optional name-change guard ───────────────────
  async updateClinic(id, data) {
    const clinic = await Clinic.findById(id);
    if (!clinic) throw new NotFoundError('Clinic');

    if (data.clinicName && data.clinicName !== clinic.clinicName) {
      await this._assertNameUnique(data.clinicName, id);
      clinic.clinicName = data.clinicName;
    }

    if (data.departmentType  !== undefined) clinic.departmentType  = data.departmentType;
    if (data.openingHours    !== undefined) clinic.openingHours    = data.openingHours;
    if (data.isActive        !== undefined) clinic.isActive        = data.isActive;
    if (data.assignedDoctors !== undefined) clinic.assignedDoctors = data.assignedDoctors;

    await clinic.save();
    return clinic.populate('assignedDoctors');
  }

  // ── Soft-delete (deactivate) ──────────────────────────────────
  async deactivate(id) {
    const clinic = await Clinic.findById(id);
    if (!clinic) throw new NotFoundError('Clinic');
    clinic.isActive = false;
    await clinic.save();
    return clinic;
  }
}

module.exports = new ClinicService();
