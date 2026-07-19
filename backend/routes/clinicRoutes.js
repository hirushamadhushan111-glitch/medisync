/**
 * clinicRoutes.js — /api/clinics/*
 *
 * Reading clinics is open to any logged-in user (booking pages need it);
 * creating/updating/deleting clinics is admin-only, and per-clinic
 * patient/appointment lists are for admin + staff.
 */
const express = require('express');
const {
  getClinics,
  getClinicById,
  createClinic,
  updateClinic,
  deleteClinic,
  getClinicPatients,
  getClinicAppointments,
} = require('../controllers/clinicController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', verifyToken, getClinics);
router.get('/:id/patients', verifyToken, authorizeRoles('admin', 'staff'), getClinicPatients);
router.get('/:id/appointments', verifyToken, authorizeRoles('admin', 'staff'), getClinicAppointments);
router.get('/:id', verifyToken, getClinicById);
router.post('/', verifyToken, authorizeRoles('admin'), createClinic);
router.put('/:id', verifyToken, authorizeRoles('admin'), updateClinic);
router.delete('/:id', verifyToken, authorizeRoles('admin'), deleteClinic);

module.exports = router;
