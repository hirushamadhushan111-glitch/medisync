/**
 * OOP Concept: Inheritance + Polymorphism + Encapsulation
 *
 * AdminService extends BaseService (User as primary model).
 * Overrides findAll to strip passwords (Polymorphism).
 * Encapsulates dashboard stats aggregation and cascade-delete logic.
 */

const bcrypt      = require('bcryptjs');
const BaseService = require('./BaseService');
const User        = require('../models/User');
const Patient     = require('../models/Patient');
const Doctor      = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Queue       = require('../models/Queue');
const Clinic      = require('../models/Clinic');
const { NotFoundError } = require('../utils/AppError');

class AdminService extends BaseService {
  // Bind this service to its Mongoose model (BaseService provides shared CRUD).
  constructor() {
    super(User, 'User');
  }

  // ── Polymorphism: override findAll to exclude password field ──
  async findAll() {
    return User.find().select('-password').populate('assignedClinics', 'clinicName departmentType').sort({ createdAt: -1 });
  }

  // ── Update any user (admin privilege) ────────────────────────
  async updateUser(id, data) {
    const updates = {};
    const allowed = ['name', 'email', 'role', 'phone', 'NIC', 'isActive'];
    allowed.forEach((field) => {
      if (data[field] !== undefined) updates[field] = data[field];
    });
    if (data.password) updates.password = await bcrypt.hash(data.password, 10);

    const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).select('-password');
    if (!user) throw new NotFoundError('User');
    return user;
  }

  // ── Cascade-delete: remove linked Patient/Doctor profile first ──
  async deleteUser(id) {
    const user = await User.findById(id);
    if (!user) throw new NotFoundError('User');
    if (user.role === 'patient') await Patient.findOneAndDelete({ userId: user._id });
    if (user.role === 'doctor')  await Doctor.findOneAndDelete({ userId: user._id });
    await user.deleteOne();
  }

  // ── Dashboard stats aggregated from multiple models ───────────
  async getDashboardStats() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);

    const [totalPatients, todaysAppointments, activeQueues, registeredDoctors, activeClinics] = await Promise.all([
      Patient.countDocuments(),
      Appointment.countDocuments({ appointmentDate: { $gte: start, $lte: end } }),
      Queue.countDocuments({ date: { $gte: start, $lte: end }, status: { $in: ['waiting', 'serving'] } }),
      Doctor.countDocuments(),
      Clinic.countDocuments({ isActive: true }),
    ]);

    return { totalPatients, todaysAppointments, activeQueues, registeredDoctors, activeClinics };
  }
}

module.exports = new AdminService();
