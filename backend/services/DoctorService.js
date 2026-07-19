/**
 * OOP Concept: Inheritance + Polymorphism + Encapsulation
 *
 * DoctorService extends BaseService.
 * Overrides findAll and findById to always populate user details (Polymorphism).
 * Encapsulates permission checks inside update/getPatients methods.
 */

const BaseService    = require('./BaseService');
const Doctor         = require('../models/Doctor');
const Clinic         = require('../models/Clinic');
const { NotFoundError, ForbiddenError } = require('../utils/AppError');

class DoctorService extends BaseService {
  // Bind this service to the Doctor model (BaseService provides shared CRUD).
  constructor() {
    super(Doctor, 'Doctor');
  }

  // ── Private populate helper (Encapsulation) ───────────────────
  _populate(query) {
    return query.populate('userId', '-password').populate('assignedPatients');
  }

  // ── Polymorphism: override findAll with sorted + populated query ──
  async findAll() {
    return this._populate(Doctor.find()).sort({ department: 1, specialization: 1 });
  }

  // ── Polymorphism: override findById with populate ─────────────
  async findById(id) {
    const doctor = await this._populate(Doctor.findById(id));
    if (!doctor) throw new NotFoundError('Doctor');
    return doctor;
  }

  // ── Find by linked User account ───────────────────────────────
  async findByUserId(userId) {
    const doctor = await Doctor.findOne({ userId }).populate('userId', '-password');
    if (!doctor) throw new NotFoundError('Doctor profile');
    return doctor;
  }

  // ── Get profile + assigned clinics ────────────────────────────
  async getProfile(userId) {
    const doctor = await this._populate(Doctor.findOne({ userId }));
    if (!doctor) throw new NotFoundError('Doctor profile');
    const clinics = await Clinic.find({ assignedDoctors: doctor._id, isActive: true }).sort({ clinicName: 1 });
    return { doctor, clinics };
  }

  // ── Toggle availability and return doctor + affected clinics ──
  async updateAvailability(userId, isAvailable) {
    const doctor = await Doctor.findOne({ userId }).populate('userId', '-password');
    if (!doctor) throw new NotFoundError('Doctor profile');
    doctor.isAvailable = isAvailable;
    doctor.availabilityUpdatedAt = new Date();
    await doctor.save();
    const clinics = await Clinic.find({ assignedDoctors: doctor._id }).select('_id clinicName');
    return { doctor, clinics };
  }

  // ── Update doctor profile (with role-based permission check) ──
  async update(id, data, requestingUser) {
    const doctor = await Doctor.findById(id);
    if (!doctor) throw new NotFoundError('Doctor');

    if (requestingUser.role === 'doctor' && doctor.userId.toString() !== requestingUser._id.toString()) {
      throw new ForbiddenError('Doctors can only update their own profile');
    }

    const allowed = ['department', 'specialization', 'consultationSchedule', 'assignedPatients'];
    allowed.forEach((field) => {
      if (data[field] !== undefined) doctor[field] = data[field];
    });
    await doctor.save();
    await doctor.populate('userId', '-password');
    return doctor;
  }

  // ── Get doctor's patient list (with role-based permission check) ──
  async getPatients(id, requestingUser) {
    const doctor = await Doctor.findById(id).populate({
      path: 'assignedPatients',
      populate: { path: 'userId', select: '-password' },
    });
    if (!doctor) throw new NotFoundError('Doctor');

    if (requestingUser.role === 'doctor' && doctor.userId.toString() !== requestingUser._id.toString()) {
      throw new ForbiddenError('Doctors can only view their own patient list');
    }
    return doctor.assignedPatients;
  }
}

module.exports = new DoctorService();
