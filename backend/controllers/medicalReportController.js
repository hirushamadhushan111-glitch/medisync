/**
 * OOP Concept: Service Layer pattern
 *
 * Controllers are thin — they handle HTTP request/response.
 * All business logic is delegated to MedicalReportService.
 * asyncHandler eliminates try/catch boilerplate.
 */

const asyncHandler         = require('../utils/asyncHandler');
const medicalReportService = require('../services/MedicalReportService');
const Patient              = require('../models/Patient');
const { NotFoundError }    = require('../utils/AppError');

// POST /api/medical-reports
const uploadReport = asyncHandler(async (req, res) => {
  let { patientId, title, reportType, description, reportDate } = req.body;

  // Patients may only upload to their own profile — ignore any sent patientId
  if (req.user.role === 'patient') {
    const own = await Patient.findOne({ userId: req.user._id });
    if (!own) throw new NotFoundError('Patient profile');
    patientId = own._id;
  }

  const report = await medicalReportService.createReport({
    patientId,
    uploadedBy: req.user._id,
    title,
    reportType,
    description,
    reportDate,
    file: req.file,
  });

  res.status(201).json({ message: 'Report uploaded successfully.', report });
});

// GET /api/medical-reports/patient/:patientId
const getPatientReports = asyncHandler(async (req, res) => {
  const reports = await medicalReportService.getByPatient(
    req.params.patientId,
    req.query.type || null
  );
  res.json({ reports });
});

// GET /api/medical-reports/my  (patient's own reports)
const getMyReports = asyncHandler(async (req, res) => {
  const reports = await medicalReportService.getMyReports(
    req.user._id,
    req.query.type || null
  );
  res.json({ reports });
});

// DELETE /api/medical-reports/:id
const deleteReport = asyncHandler(async (req, res) => {
  const result = await medicalReportService.deleteById(req.params.id);
  res.json(result);
});

module.exports = { uploadReport, getPatientReports, getMyReports, deleteReport };
