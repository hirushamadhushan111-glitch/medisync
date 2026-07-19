/**
 * OOP Concept: Service Layer + asyncHandler (Decorator pattern)
 *
 * Controllers are thin — HTTP in, HTTP out.
 * DoctorService handles profile, availability, and permission checks.
 * asyncHandler eliminates try/catch boilerplate.
 */

const asyncHandler   = require('../utils/asyncHandler');
const doctorService  = require('../services/DoctorService');
const { NotFoundError, ForbiddenError } = require('../utils/AppError');
const Doctor         = require('../models/Doctor');
const Patient        = require('../models/Patient');
const MedicalRecord  = require('../models/MedicalRecord');
const PDFDocument    = require('pdfkit');
const withDrPrefix   = require('../utils/drName');

// GET /api/doctors
const getDoctors = asyncHandler(async (req, res) => {
  const doctors = await doctorService.findAll();
  res.json({ doctors });
});

// GET /api/doctors/:id
const getDoctorById = asyncHandler(async (req, res) => {
  const doctor = await doctorService.findById(req.params.id);
  res.json({ doctor });
});

// GET /api/doctors/me
const getMyDoctorProfile = asyncHandler(async (req, res) => {
  const { doctor, clinics } = await doctorService.getProfile(req.user._id);
  res.json({ doctor, clinics });
});

// PUT /api/doctors/availability
const updateAvailability = asyncHandler(async (req, res) => {
  const { doctor, clinics } = await doctorService.updateAvailability(req.user._id, req.body.isAvailable);

  const payload = {
    doctorId: doctor._id,
    doctorName: doctor.userId?.name,
    isAvailable: doctor.isAvailable,
    availabilityUpdatedAt: doctor.availabilityUpdatedAt,
    clinicIds: clinics.map((c) => c._id),
  };
  const io = req.app.get('io');
  clinics.forEach((clinic) => io?.to(`clinic:${clinic._id}`).emit('doctor:status_changed', payload));

  res.json({ message: `Availability changed to ${doctor.isAvailable ? 'available' : 'unavailable'}`, doctor });
});

// PUT /api/doctors/:id
const updateDoctor = asyncHandler(async (req, res) => {
  const doctor = await doctorService.update(req.params.id, req.body, req.user);
  res.json({ message: 'Doctor updated successfully', doctor });
});

// GET /api/doctors/:id/patients
const getDoctorPatients = asyncHandler(async (req, res) => {
  const patients = await doctorService.getPatients(req.params.id, req.user);
  res.json({ patients });
});

// POST /api/doctors/records
// Save a consultation as a new medical record (Consultation Record page).
const addMedicalRecord = asyncHandler(async (req, res) => {
  // The logged-in user is the doctor writing the record.
  const doctor = await Doctor.findOne({ userId: req.user._id });
  if (!doctor) throw new NotFoundError('Doctor profile');

  const { patientId, clinicId, symptoms, diagnosis, prescription, labReports,
          treatmentNotes, notes, followUpInstructions, followUpDate,
          doctorComments, tags } = req.body;

  const patient = await Patient.findById(patientId);
  if (!patient) throw new NotFoundError('Patient');

  const record = await MedicalRecord.create({
    patientId,
    doctorId: doctor._id,
    clinicId: clinicId || undefined,
    symptoms,
    diagnosis,
    prescription:        prescription || [],
    labReports:          labReports   || [],
    treatmentNotes,
    notes:               notes || treatmentNotes,
    followUpInstructions,
    followUpDate,
    doctorComments,
    // Tags cleaned up: trimmed, lowercased, blanks removed, duplicates dropped.
    tags: [...new Set((tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean))],
  });

  // Remember this patient in the doctor's own patient list ($addToSet = no duplicates).
  await Doctor.findByIdAndUpdate(doctor._id, { $addToSet: { assignedPatients: patientId } });
  res.status(201).json({ message: 'Medical record added successfully', record });
});

// GET /api/doctors/records/patient/:id
// All records of one patient (used by doctors and by the patient's
// own Medical History page).
const getRecordsForPatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) throw new NotFoundError('Patient');

  // Privacy: a patient may only open their OWN history.
  if (req.user.role === 'patient' && patient.userId.toString() !== req.user._id.toString()) {
    throw new ForbiddenError('Patients can only view their own records');
  }

  // Latest visit first, with doctor + clinic names filled in.
  const records = await MedicalRecord.find({ patientId: req.params.id })
    .populate({ path: 'doctorId', populate: { path: 'userId', select: '-password' } })
    .populate('clinicId', 'clinicName departmentType')
    .sort({ visitDate: -1 });

  res.json({ records });
});

// GET /api/doctors/records/:id
const getRecordById = asyncHandler(async (req, res) => {
  const record = await MedicalRecord.findById(req.params.id)
    .populate({ path: 'doctorId',  populate: { path: 'userId', select: '-password' } })
    .populate({ path: 'patientId', populate: { path: 'userId', select: '-password' } })
    .populate('clinicId', 'clinicName departmentType');

  if (!record) throw new NotFoundError('Medical record');

  // Same privacy rule as above — only the owner patient may see it.
  if (req.user.role === 'patient' && record.patientId.userId._id.toString() !== req.user._id.toString()) {
    throw new ForbiddenError('Access denied');
  }

  res.json({ record });
});

// PUT /api/doctors/records/:id
const updateRecord = asyncHandler(async (req, res) => {
  const record = await MedicalRecord.findById(req.params.id);
  if (!record) throw new NotFoundError('Medical record');

  // Admin can edit any record; a doctor can only edit records they wrote.
  if (req.user.role !== 'admin') {
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) throw new NotFoundError('Doctor profile');
    if (record.doctorId.toString() !== doctor._id.toString()) {
      throw new ForbiddenError('Doctors can only update their own records');
    }
  }

  // Only medical fields may change — patient/doctor links stay locked.
  const allowed = ['symptoms', 'diagnosis', 'prescription', 'labReports', 'treatmentNotes',
                   'notes', 'followUpInstructions', 'followUpDate', 'doctorComments', 'tags'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) record[field] = req.body[field];
  });
  await record.save();
  res.json({ message: 'Medical record updated successfully', record });
});

// GET /api/records/patient/:id/history-pdf
// Full medical history of a patient as a downloadable PDF.
const getPatientHistoryPdf = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id)
    .populate('userId', '-password')
    .populate('registeredClinics', 'clinicName');
  if (!patient) throw new NotFoundError('Patient');

  if (req.user.role === 'patient' && patient.userId._id.toString() !== req.user._id.toString()) {
    throw new ForbiddenError('Patients can only download their own history');
  }

  const records = await MedicalRecord.find({ patientId: patient._id })
    .populate({ path: 'doctorId', populate: { path: 'userId', select: '-password' } })
    .populate('clinicId', 'clinicName')
    .sort({ visitDate: -1 });

  const patientName = patient.userId?.name || 'Patient';

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="medical-history-${patient._id}.pdf"`);
  doc.pipe(res);

  // ── Header ──────────────────────────────────────────────────────
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#1e3a5f').text('MediSync', { align: 'center' });
  doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text('Patient Medical History', { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#1e3a5f').lineWidth(1.5).stroke();
  doc.moveDown(0.6);

  // ── Patient info ────────────────────────────────────────────────
  doc.fillColor('#111').fontSize(10);
  doc.font('Helvetica-Bold').text('Patient: ',  { continued: true }).font('Helvetica').text(patientName);
  doc.font('Helvetica-Bold').text('NIC: ',      { continued: true }).font('Helvetica').text(patient.NIC || '—');
  if (patient.age) doc.font('Helvetica-Bold').text('Age: ', { continued: true }).font('Helvetica').text(String(patient.age));
  if (patient.bloodGroup) doc.font('Helvetica-Bold').text('Blood Group: ', { continued: true }).font('Helvetica').text(patient.bloodGroup);
  // Names of the clinics this patient is registered in (for the PDF header).
  
  const registeredClinicNames = (patient.registeredClinics || []).map((c) => c?.clinicName).filter(Boolean);
  doc.font('Helvetica-Bold').text('Registered Clinics: ', { continued: true }).font('Helvetica')
    .text(registeredClinicNames.length ? registeredClinicNames.join(', ') : '—');
  doc.font('Helvetica-Bold').text('Total Visits: ', { continued: true }).font('Helvetica').text(String(records.length));
  doc.font('Helvetica-Bold').text('Generated: ',    { continued: true }).font('Helvetica').text(new Date().toLocaleString('en-GB'));
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  doc.moveDown(0.8);

  if (records.length === 0) {
    doc.fontSize(11).font('Helvetica').fillColor('#6b7280').text('No medical records found for this patient.', { align: 'center' });
  }

  // ── Visit entries (newest first) ────────────────────────────────
  records.forEach((record, index) => {
    if (doc.y > 680) doc.addPage();

    const visitDate  = new Date(record.visitDate).toLocaleDateString('en-GB');
    const doctorName = withDrPrefix(record.doctorId?.userId?.name) || 'Doctor';
    const clinicName = record.clinicId?.clinicName || 'General OPD';

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f')
      .text(`Visit ${records.length - index} — ${visitDate}`, { continued: true })
      .fontSize(9).font('Helvetica').fillColor('#6b7280').text(`   (${clinicName} · ${doctorName})`);
    doc.moveDown(0.2);

    doc.fontSize(10).fillColor('#111');
    doc.font('Helvetica-Bold').text('Diagnosis: ', { continued: true }).font('Helvetica').text(record.diagnosis || '—');
    doc.font('Helvetica-Bold').text('Symptoms: ',  { continued: true }).font('Helvetica').text(record.symptoms || '—');

    if (record.prescription?.length > 0) {
      doc.font('Helvetica-Bold').text('Prescription:');
      record.prescription.forEach((p) => {
        doc.font('Helvetica').text(`   • ${p.medicine} — ${p.dosage} — ${p.duration}`);
      });
    }
    if (record.treatmentNotes) {
      doc.font('Helvetica-Bold').text('Treatment Notes: ', { continued: true }).font('Helvetica').text(record.treatmentNotes);
    }
    if (record.followUpDate) {
      doc.font('Helvetica-Bold').text('Follow-up: ', { continued: true }).font('Helvetica')
        .text(new Date(record.followUpDate).toLocaleDateString('en-GB'));
    }

    doc.moveDown(0.4);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    doc.moveDown(0.6);
  });

  doc.fontSize(8).fillColor('#9ca3af').text('Generated by MediSync — Smart OPD Queue & Centralized Patient History System', 50, 780, { align: 'center' });
  doc.end();
});

// GET /api/records/:id/prescription-pdf
const getPrescriptionPdf = asyncHandler(async (req, res) => {
  const record = await MedicalRecord.findById(req.params.id)
    .populate({ path: 'doctorId',  populate: { path: 'userId', select: '-password' } })
    .populate({ path: 'patientId', populate: { path: 'userId', select: '-password' } })
    .populate('clinicId', 'clinicName');

  if (!record) throw new NotFoundError('Medical record');

  if (req.user.role === 'patient' && record.patientId.userId._id.toString() !== req.user._id.toString()) {
    throw new ForbiddenError('Access denied');
  }

  const patientName = record.patientId?.userId?.name || 'Patient';
  const doctorName  = withDrPrefix(record.doctorId?.userId?.name) || 'Doctor';
  const clinicName  = record.clinicId?.clinicName || 'General OPD';
  const visitDate   = new Date(record.visitDate).toLocaleDateString('en-GB');

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="prescription-${record._id}.pdf"`);
  doc.pipe(res);

  // ── Header ──────────────────────────────────────────────────────
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#1e3a5f').text('MediSync', { align: 'center' });
  doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text('Medical Prescription', { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#1e3a5f').lineWidth(1.5).stroke();
  doc.moveDown(0.6);

  // ── Patient / Doctor info ────────────────────────────────────────
  doc.fillColor('#111').fontSize(10);
  doc.font('Helvetica-Bold').text('Patient: ', { continued: true }).font('Helvetica').text(patientName);
  doc.font('Helvetica-Bold').text('Doctor: ',  { continued: true }).font('Helvetica').text(doctorName);
  doc.font('Helvetica-Bold').text('Clinic: ',  { continued: true }).font('Helvetica').text(clinicName);
  doc.font('Helvetica-Bold').text('Date: ',    { continued: true }).font('Helvetica').text(visitDate);
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  doc.moveDown(0.6);

  // ── Diagnosis ────────────────────────────────────────────────────
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('Diagnosis');
  doc.fontSize(10).font('Helvetica').fillColor('#111').text(record.diagnosis);
  doc.moveDown(0.5);

  // ── Symptoms ─────────────────────────────────────────────────────
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('Symptoms');
  doc.fontSize(10).font('Helvetica').fillColor('#111').text(record.symptoms);
  doc.moveDown(0.6);

  // ── Prescription table ───────────────────────────────────────────
  if (record.prescription?.length > 0) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('Prescription');
    doc.moveDown(0.3);

    const top  = doc.y;
    const cols = [50, 230, 370, 495];
    const rowH = 20;

    // Table header
    doc.rect(50, top, 495, rowH).fill('#1e3a5f');
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
    ['Medicine', 'Dosage', 'Duration'].forEach((h, i) => doc.text(h, cols[i] + 5, top + 5, { width: cols[i + 1] - cols[i] - 5 }));

    let y = top + rowH;
    record.prescription.forEach((item, i) => {
      doc.rect(50, y, 495, rowH).fill(i % 2 === 0 ? '#f8fafc' : '#ffffff');
      doc.fillColor('#111').fontSize(9).font('Helvetica');
      doc.text(item.medicine, cols[0] + 5, y + 5, { width: cols[1] - cols[0] - 5 });
      doc.text(item.dosage,   cols[1] + 5, y + 5, { width: cols[2] - cols[1] - 5 });
      doc.text(item.duration, cols[2] + 5, y + 5, { width: cols[3] - cols[2] - 5 });
      y += rowH;
    });
    doc.rect(50, top, 495, y - top).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    doc.y = y + 10;
    doc.moveDown(0.5);
  }

  // ── Follow-up ────────────────────────────────────────────────────
  if (record.followUpInstructions) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('Follow-up Instructions');
    doc.fontSize(10).font('Helvetica').fillColor('#111').text(record.followUpInstructions);
    if (record.followUpDate) {
      doc.text(`Follow-up Date: ${new Date(record.followUpDate).toLocaleDateString('en-GB')}`);
    }
    doc.moveDown(0.5);
  }

  // ── Notes ────────────────────────────────────────────────────────
  if (record.notes) {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text('Notes');
    doc.fontSize(10).font('Helvetica').fillColor('#111').text(record.notes);
    doc.moveDown(0.5);
  }

  // ── Footer ───────────────────────────────────────────────────────
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  doc.moveDown(0.3);
  doc.fontSize(8).fillColor('#9ca3af')
    .text(`Generated by MediSync · ${new Date().toLocaleString('en-GB')}`, { align: 'center' })
    .text('This document is computer-generated and valid without a physical signature.', { align: 'center' });

  doc.end();
});

module.exports = {
  getDoctors, getDoctorById, getMyDoctorProfile, updateAvailability,
  updateDoctor, getDoctorPatients, addMedicalRecord, getRecordsForPatient,
  getRecordById, updateRecord, getPrescriptionPdf, getPatientHistoryPdf,
};
