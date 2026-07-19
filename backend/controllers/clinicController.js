/**
 * OOP Concept: Service Layer + asyncHandler (Decorator pattern)
 *
 * Controllers are thin — HTTP in, HTTP out.
 * All clinic CRUD is delegated to ClinicService.
 * asyncHandler eliminates try/catch boilerplate.
 */

const asyncHandler  = require('../utils/asyncHandler');
const clinicService = require('../services/ClinicService');
const Patient       = require('../models/Patient');
const Appointment   = require('../models/Appointment');

// GET /api/clinics
const getClinics = asyncHandler(async (req, res) => {
  const clinics = await clinicService.findAll();
  res.json({ clinics });
});

// GET /api/clinics/:id
const getClinicById = asyncHandler(async (req, res) => {
  const clinic = await clinicService.findById(req.params.id, 'assignedDoctors');
  res.json({ clinic });
});

// POST /api/clinics
const createClinic = asyncHandler(async (req, res) => {
  const clinic = await clinicService.createClinic(req.body);
  res.status(201).json({ message: 'Clinic created successfully', clinic });
});

// PUT /api/clinics/:id
const updateClinic = asyncHandler(async (req, res) => {
  const clinic = await clinicService.updateClinic(req.params.id, req.body);
  res.json({ message: 'Clinic updated successfully', clinic });
});

// DELETE /api/clinics/:id  (soft-delete: set isActive = false)
const deleteClinic = asyncHandler(async (req, res) => {
  const clinic = await clinicService.deactivate(req.params.id);
  res.json({ message: 'Clinic deactivated successfully', clinic });
});

// GET /api/clinics/:id/patients  (admin/staff — patients registered to this clinic)
const getClinicPatients = asyncHandler(async (req, res) => {
  const patients = await Patient.find({ registeredClinics: req.params.id })
    .populate('userId', '-password')
    .populate('registeredClinics', 'clinicName departmentType')
    .sort({ createdAt: -1 });
  res.json({ patients });
});

// GET /api/clinics/:id/appointments?date=YYYY-MM-DD  (admin/staff — a day's bookings)
const getClinicAppointments = asyncHandler(async (req, res) => {
  const date  = req.query.date ? new Date(req.query.date) : new Date();
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end   = new Date(date); end.setHours(23, 59, 59, 999);

  const appointments = await Appointment.find({
    clinicId: req.params.id,
    appointmentDate: { $gte: start, $lte: end },
  })
    .populate({ path: 'patientId', populate: { path: 'userId', select: '-password' } })
    .populate({ path: 'doctorId',  populate: { path: 'userId', select: '-password' } })
    .sort({ queueNumber: 1 });

  res.json({ appointments });
});

module.exports = { getClinics, getClinicById, createClinic, updateClinic, deleteClinic, getClinicPatients, getClinicAppointments };
