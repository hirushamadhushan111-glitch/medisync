/**
 * patientRoutes.js — /api/patients/*
 *
 * Staff/doctor/admin can list, search, and update patients;
 * a patient can only read their own profile via /me.
 * Note: '/search' and '/me' are registered BEFORE '/:id' so they are
 * not swallowed by the id parameter route.
 */
const express = require('express');
const {
  getPatients,
  searchPatients,
  getMyPatientProfile,
  getPatientById,
  updatePatient,
  addPatientClinic,
  getPatientHistory,
} = require('../controllers/patientController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(verifyToken);

router.get('/', authorizeRoles('admin', 'doctor', 'staff'), getPatients);
router.get('/search', authorizeRoles('admin', 'doctor', 'staff'), searchPatients);
router.get('/me', authorizeRoles('patient'), getMyPatientProfile);
router.get('/:id', authorizeRoles('admin', 'doctor', 'staff'), getPatientById);
router.put('/:id', authorizeRoles('admin', 'staff'), updatePatient);
router.post('/:id/clinics', authorizeRoles('admin', 'staff', 'doctor'), addPatientClinic);
router.get('/:id/history', authorizeRoles('admin', 'doctor', 'staff'), getPatientHistory);

module.exports = router;
