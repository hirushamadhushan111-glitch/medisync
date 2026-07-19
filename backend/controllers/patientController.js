/**
 * OOP Concept: Service Layer + asyncHandler (Decorator pattern)
 *
 * Controllers are thin — HTTP in, HTTP out.
 * Patient queries are delegated to PatientService.
 * asyncHandler eliminates try/catch boilerplate.
 */

const mongoose         = require('mongoose');
const asyncHandler     = require('../utils/asyncHandler');
const patientService   = require('../services/PatientService');
const { ValidationError, NotFoundError } = require('../utils/AppError');
const Patient          = require('../models/Patient');
const MedicalRecord    = require('../models/MedicalRecord');
const User             = require('../models/User');
const Clinic           = require('../models/Clinic');

// GET /api/patients?clinicId=   (optional filter: patients registered to a clinic)
const getPatients = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.clinicId) filter.registeredClinics = req.query.clinicId;
  const patients = await patientService.findAll(filter, { sort: '-createdAt', limit: 200 });
  res.json({ patients });
});

// GET /api/patients/search
// Live search box (navbar + PatientSearchInput): one term matches
// name, phone, or NIC.
const searchPatients = asyncHandler(async (req, res) => {
  const { q, NIC, phone } = req.query;
  const term = q || NIC || phone;
  if (!term || term.trim().length < 2) {
    throw new ValidationError('Search term must be at least 2 characters');
  }

  // Two steps: name/phone live on User, NIC lives on Patient —
  // first find matching users, then patients by NIC or those users.
  const users   = await User.find({
    role: 'patient',
    $or: [
      { name:  { $regex: term, $options: 'i' } },
      { phone: { $regex: term, $options: 'i' } },
    ],
  }).select('_id');

  const userIds  = users.map((u) => u._id);
  const patients = await Patient.find({
    $or: [
      { NIC:    { $regex: term, $options: 'i' } },
      { userId: { $in: userIds } },
    ],
  })
    .populate('userId', '-password')
    .populate('registeredClinics', 'clinicName departmentType')
    .limit(8);

  res.json({ patients });
});

// GET /api/patients/:id
const getPatientById = asyncHandler(async (req, res) => {
  const patient = await patientService.getFullProfile(req.params.id);
  res.json({ patient });
});

// GET /api/patients/me
const getMyPatientProfile = asyncHandler(async (req, res) => {
  const patient = await patientService.findByUserId(req.user._id);
  res.json({ patient });
});

// PUT /api/patients/:id
const updatePatient = asyncHandler(async (req, res) => {
  // Whitelist of editable profile fields — copy over only what was sent.
  const allowed = ['dateOfBirth', 'gender', 'age', 'address', 'bloodGroup', 'emergencyContact', 'medicalHistory', 'registeredClinics'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const patient = await patientService.updateById(req.params.id, updates);
  await patient.populate('userId', '-password');
  res.json({ message: 'Patient updated successfully', patient });
});

// POST /api/patients/:id/clinics — register an existing patient to one more
// clinic. Doctors, reception staff, and admins can all do this so a patient
// who develops a new condition is moved into the right clinic on the spot.
const addPatientClinic = asyncHandler(async (req, res) => {
  const { clinicId } = req.body;
  if (!mongoose.isValidObjectId(clinicId)) throw new ValidationError('A valid clinic is required');

  const clinic = await Clinic.findById(clinicId);
  if (!clinic || !clinic.isActive) throw new NotFoundError('Clinic');

  const patient = await Patient.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { registeredClinics: clinic._id } },
    { new: true }
  )
    .populate('userId', '-password')
    .populate('registeredClinics', 'clinicName departmentType');
  if (!patient) throw new NotFoundError('Patient');

  res.json({ message: `Patient registered to ${clinic.clinicName}`, patient });
});

// GET /api/patients/:id/history
const getPatientHistory = asyncHandler(async (req, res) => {
  const patient = await patientService.findById(req.params.id);
  const records = await MedicalRecord.find({ patientId: req.params.id })
    .populate({ path: 'doctorId', populate: { path: 'userId', select: '-password' } })
    .populate('clinicId', 'clinicName departmentType')
    .sort({ visitDate: -1 });
  res.json({ patient, records });
});

module.exports = { getPatients, searchPatients, getMyPatientProfile, getPatientById, updatePatient, addPatientClinic, getPatientHistory };
