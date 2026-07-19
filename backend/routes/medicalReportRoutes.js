/**
 * medicalReportRoutes.js — /api/medical-reports/*
 * Upload / list / delete lab-report files (PDF or image, stored in
 * Cloudinary). See MedicalReport model for the metadata shape.
 */
const express = require('express');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { uploadReport: uploadMiddleware } = require('../config/cloudinary');
const {
  uploadReport,
  getPatientReports,
  getMyReports,
  deleteReport,
} = require('../controllers/medicalReportController');

const router = express.Router();

// Patient — own reports
router.get('/my', verifyToken, authorizeRoles('patient'), getMyReports);

// Upload a report — staff/doctor/admin upload for any patient; patients
// upload for themselves (controller forces patientId to their own profile)
router.post(
  '/',
  verifyToken,
  authorizeRoles('staff', 'doctor', 'admin', 'patient'),
  uploadMiddleware,
  uploadReport
);

// Staff / Doctor / Admin — view any patient's reports
router.get(
  '/patient/:patientId',
  verifyToken,
  authorizeRoles('staff', 'doctor', 'admin'),
  getPatientReports
);

// Staff / Doctor / Admin — delete a report
router.delete(
  '/:id',
  verifyToken,
  authorizeRoles('staff', 'doctor', 'admin'),
  deleteReport
);

module.exports = router;
