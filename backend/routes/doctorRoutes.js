/**
 * doctorRoutes.js — exports TWO routers (mounted in server.js):
 *
 *   router       → /api/doctors/*  : doctor list, own profile, availability
 *   recordRouter → /api/records/*  : medical (consultation) records + the
 *                                    prescription / history PDF downloads
 *
 * Consultation records are created by doctors only; every input field is
 * validated with express-validator rules before reaching the controller.
 */
const express = require('express');
const { body, param } = require('express-validator');
const {
  getDoctors,
  getDoctorById,
  getMyDoctorProfile,
  updateAvailability,
  updateDoctor,
  getDoctorPatients,
  addMedicalRecord,
  getRecordsForPatient,
  getRecordById,
  updateRecord,
  getPrescriptionPdf,
  getPatientHistoryPdf,
} = require('../controllers/doctorController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
const recordRouter = express.Router();

// All routes below need a logged-in user (JWT checked first).
router.use(verifyToken);

// ── /api/doctors — doctor list, own profile, availability ─────────
router.get('/', authorizeRoles('patient', 'doctor', 'staff', 'admin'), getDoctors);
router.get('/me', authorizeRoles('doctor'), getMyDoctorProfile);
router.patch(
  '/me/availability',
  authorizeRoles('doctor'),
  body('isAvailable').isBoolean().withMessage('isAvailable must be true or false'),
  validateRequest,
  updateAvailability
);
router.get(
  '/:id',
  authorizeRoles('patient', 'doctor', 'staff', 'admin'),
  param('id').isMongoId().withMessage('Invalid doctor id'),
  validateRequest,
  getDoctorById
);
router.put(
  '/:id',
  authorizeRoles('doctor', 'admin'),
  param('id').isMongoId().withMessage('Invalid doctor id'),
  validateRequest,
  updateDoctor
);
router.get(
  '/:id/patients',
  authorizeRoles('doctor', 'admin'),
  param('id').isMongoId().withMessage('Invalid doctor id'),
  validateRequest,
  getDoctorPatients
);

// ── /api/records — consultation records ───────────────────────────
recordRouter.use(verifyToken);
recordRouter.post(
  '/',
  authorizeRoles('doctor'),
  body('patientId').isMongoId().withMessage('A valid patient is required'),
  body('clinicId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid clinic id'),
  body('symptoms').trim().isLength({ min: 2, max: 3000 }).withMessage('Symptoms must be 2-3000 characters'),
  body('diagnosis').trim().isLength({ min: 2, max: 3000 }).withMessage('Diagnosis must be 2-3000 characters'),
  body('prescription').optional().isArray({ max: 30 }).withMessage('Prescription must be an array'),
  body('prescription.*.medicine').optional().trim().notEmpty().withMessage('Medicine name is required'),
  body('prescription.*.dosage').optional().trim().notEmpty().withMessage('Dosage is required'),
  body('prescription.*.duration').optional().trim().notEmpty().withMessage('Duration is required'),
  body('followUpDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid follow-up date'),
  body('followUpInstructions').optional().trim().isLength({ max: 2000 }),
  body('notes').optional().trim().isLength({ max: 5000 }),
  body('tags').optional().isArray({ max: 20 }).withMessage('Tags must be an array'),
  body('tags.*').optional().trim().isLength({ min: 1, max: 80 }),
  validateRequest,
  addMedicalRecord
);
recordRouter.get(
  '/patient/:id',
  authorizeRoles('patient', 'doctor', 'staff', 'admin'),
  param('id').isMongoId().withMessage('Invalid patient id'),
  validateRequest,
  getRecordsForPatient
);
recordRouter.get(
  '/patient/:id/history-pdf',
  authorizeRoles('patient', 'doctor', 'staff', 'admin'),
  param('id').isMongoId().withMessage('Invalid patient id'),
  validateRequest,
  getPatientHistoryPdf
);
recordRouter.get(
  '/:id',
  authorizeRoles('patient', 'doctor', 'staff', 'admin'),
  param('id').isMongoId().withMessage('Invalid record id'),
  validateRequest,
  getRecordById
);
recordRouter.put(
  '/:id',
  authorizeRoles('doctor', 'admin'),
  param('id').isMongoId().withMessage('Invalid record id'),
  body('tags').optional().isArray({ max: 20 }),
  validateRequest,
  updateRecord
);

recordRouter.get(
  '/:id/prescription-pdf',
  authorizeRoles('patient', 'doctor', 'staff', 'admin'),
  param('id').isMongoId().withMessage('Invalid record id'),
  validateRequest,
  getPrescriptionPdf
);

module.exports = { router, recordRouter };
