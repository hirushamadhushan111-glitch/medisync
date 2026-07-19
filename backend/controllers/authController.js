/**
 * OOP Concept: Service Layer + asyncHandler
 *
 * Controllers are kept thin — HTTP in, HTTP out.
 * Business logic (hashing, token generation, validation)
 * is encapsulated inside UserService.
 *
 * asyncHandler (Decorator pattern) removes try/catch boilerplate
 * and forwards errors to the global error middleware.
 */

const bcrypt       = require('bcryptjs');
const User         = require('../models/User');
const Patient      = require('../models/Patient');
const Doctor       = require('../models/Doctor');
const Clinic       = require('../models/Clinic');
const userService  = require('../services/UserService');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError, ForbiddenError, ConflictError } = require('../utils/AppError');
const { isFilled, isValidEmail, isValidPassword, isValidPhone, isValidNIC } = require('../utils/validators');
const logAudit     = require('../utils/auditLogger');

// ── Helpers ───────────────────────────────────────────────────────
const publicUser = (user) => {
  const data = user.toObject ? user.toObject() : { ...user };
  delete data.password;
  return data;
};

// Who may create which account type: admin → any, staff → patient/doctor.
const canCreate = (creatorRole, targetRole) => {
  if (creatorRole === 'admin')  return ['patient', 'doctor', 'staff'].includes(targetRole);
  if (creatorRole === 'staff')  return ['patient', 'doctor'].includes(targetRole);
  return false;
};

// ── POST /api/auth/login ──────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { token, user } = await userService.login(email, password);
  res.json({ message: 'Login successful', token, role: user.role, user });
});

// ── GET /api/auth/me ──────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user, role: req.user.role });
});

// ── POST /api/auth/create-user ────────────────────────────────────
const createUser = asyncHandler(async (req, res) => {
  const {
    name, email, password, role, phone, NIC, designation,
    dateOfBirth, gender, age, weight, height, address, bloodGroup, emergencyContact,
    department, specialization, consultationSchedule, registeredClinics,
  } = req.body;

  // ── Required fields (QA standard: nothing may be left empty) ──
  if (!name || !email || !password || !role || !phone || !NIC) {
    throw new ValidationError('Name, email, password, role, phone, and NIC are required.');
  }

  // ── Format rules — same QA standard as the frontend validators ──
  // Re-checked here because the API can be called without the browser form.
  if (!isValidEmail(email))       throw new ValidationError('Please enter a valid email address.');
  if (!isValidPassword(password)) throw new ValidationError('Password must be at least 6 characters long.');
  if (!isValidPhone(phone))       throw new ValidationError('Phone number must be exactly 10 digits (e.g. 0712345678).');
  if (!isValidNIC(NIC))           throw new ValidationError('NIC must be exactly 12 digits, or 9 digits ending with the letter "V".');

  if (!canCreate(req.user.role, role)) {
    throw new ForbiddenError('You do not have permission to create this account type.');
  }
  if (role === 'doctor' && (!department || !specialization)) {
    throw new ValidationError('Department and specialization are required for doctors.');
  }
  if (role === 'staff' && !designation) {
    throw new ValidationError('Designation is required for staff accounts.');
  }
  if (role === 'patient') {
    // Emergency contact is mandatory for patients, and its phone follows
    // the same 10-digit rule as the main phone number.
    if (!isFilled(emergencyContact?.name)) {
      throw new ValidationError('Emergency contact name is required.');
    }
    if (!isValidPhone(emergencyContact?.phone)) {
      throw new ValidationError('Emergency contact phone must be exactly 10 digits.');
    }
    if (!Array.isArray(registeredClinics) || registeredClinics.length === 0) {
      throw new ValidationError('Every patient must be registered to at least one clinic.');
    }
    const clinicCount = await Clinic.countDocuments({ _id: { $in: registeredClinics }, isActive: true });
    if (clinicCount !== registeredClinics.length) {
      throw new ValidationError('One or more selected clinics are invalid or inactive.');
    }
  }

  // Duplicate check — email and NIC must both be unique in the system.
  const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { NIC }] });
  if (existing) throw new ConflictError('A user with this email or NIC already exists.');

  // Create the login account (password stored only as a bcrypt hash).
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password: await bcrypt.hash(password, 10),
    role, phone, NIC,
    designation: role === 'staff' ? designation : undefined,
  });

  // Create the role-specific profile. If it fails, the try/catch below
  // deletes the just-created user so we never keep a half-made account.
  let profile = null;
  try {
    if (role === 'patient') {
      profile = await Patient.create({
        userId: user._id, NIC, dateOfBirth, gender, age, weight, height,
        address, bloodGroup, emergencyContact, registeredClinics,
      });
    }
    if (role === 'doctor') {
      profile = await Doctor.create({
        userId: user._id, department, specialization,
        consultationSchedule: consultationSchedule || [],
      });
    }
  } catch (err) {
    await User.findByIdAndDelete(user._id);
    throw err;
  }

  res.status(201).json({ message: 'User created successfully', user: publicUser(user), profile });

  logAudit({
    action:      'USER_CREATE',
    performedBy: req.user._id,
    targetModel: 'User',
    targetId:    user._id,
    targetName:  user.name,
    details:     { email: user.email, role: user.role },
    req,
  });
});

// ── GET /api/auth/profile ─────────────────────────────────────────
const getMyProfile = asyncHandler(async (req, res) => {
  const { role, _id } = req.user;
  let profile = null;
  if (role === 'patient') profile = await Patient.findOne({ userId: _id });
  else if (role === 'doctor') profile = await Doctor.findOne({ userId: _id });
  res.json({ user: req.user, profile });
});

// ── PUT /api/auth/profile ─────────────────────────────────────────
const updateMyProfile = asyncHandler(async (req, res) => {
  const { role, _id } = req.user;
  const {
    name, phone, password, designation,
    dateOfBirth, gender, age, weight, height, address, bloodGroup, emergencyContact,
    department, specialization, consultationSchedule,
  } = req.body;

  // Profile updates are partial (only sent fields change), but any field
  // that IS sent must still pass the same QA format rules as registration.
  if (phone && !isValidPhone(phone)) {
    throw new ValidationError('Phone number must be exactly 10 digits (e.g. 0712345678).');
  }
  if (password && !isValidPassword(password)) {
    throw new ValidationError('Password must be at least 6 characters long.');
  }
  if (emergencyContact?.phone && !isValidPhone(emergencyContact.phone)) {
    throw new ValidationError('Emergency contact phone must be exactly 10 digits.');
  }

  // Split the updates: account fields go to User, medical/role fields
  // go to the Patient/Doctor profile below.
  const userUpdates = {};
  if (name)       userUpdates.name  = name;
  if (phone)      userUpdates.phone = phone;
  if (role === 'staff' && designation !== undefined) userUpdates.designation = designation;
  if (password)   userUpdates.password = await bcrypt.hash(password, 10);

  const updatedUser = await User.findByIdAndUpdate(_id, userUpdates, { new: true, runValidators: true }).select('-password');

  let profile = null;
  if (role === 'patient') {
    const updates = {};
    if (dateOfBirth  !== undefined) updates.dateOfBirth      = dateOfBirth;
    if (gender       !== undefined) updates.gender           = gender;
    if (age          !== undefined) updates.age              = age;
    if (weight       !== undefined) updates.weight           = weight;
    if (height       !== undefined) updates.height           = height;
    if (address      !== undefined) updates.address          = address;
    if (bloodGroup   !== undefined) updates.bloodGroup       = bloodGroup;
    if (emergencyContact !== undefined) updates.emergencyContact = emergencyContact;
    profile = await Patient.findOneAndUpdate({ userId: _id }, updates, { new: true, runValidators: true });
  }
  if (role === 'doctor') {
    const updates = {};
    if (department            !== undefined) updates.department            = department;
    if (specialization        !== undefined) updates.specialization        = specialization;
    if (consultationSchedule  !== undefined) updates.consultationSchedule  = consultationSchedule;
    profile = await Doctor.findOneAndUpdate({ userId: _id }, updates, { new: true, runValidators: true });
  }

  res.json({ message: 'Profile updated successfully', user: updatedUser, profile });
});

// ── POST /api/auth/avatar ─────────────────────────────────────────
const uploadAvatarHandler = asyncHandler(async (req, res) => {
  if (!req.file) throw new ValidationError('No image file provided.');

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: req.file.path },
    { new: true }
  ).select('-password');

  res.json({ message: 'Avatar uploaded successfully', user: updatedUser, avatar: req.file.path });
});

module.exports = { createUser, login, getMe, getMyProfile, updateMyProfile, uploadAvatarHandler };
