/**
 * adminRoutes.js — /api/admin/*
 *
 * Admin management APIs: users, clinics, staff-clinic assignment,
 * audit logs, role permissions, medical records, dashboard stats,
 * and CSV bulk-import of patients.
 */
const express = require('express');
const {
  getUsers,
  updateUser,
  deleteUser,
  dashboardStats,
  listClinics,
  createClinic,
  updateClinic,
  deleteClinic,
  assignStaffClinics,
  getAuditLogs,
  importPatients,
  getRolePermissions,
  updateRolePermissions,
  getAllRecords,
  updateMedicalRecord,
  deleteMedicalRecord,
} = require('../controllers/adminController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { csvUpload } = require('../config/cloudinary');

const router = express.Router();

// Clinic list is readable by every role (dropdowns across the app).
router.get('/clinics', verifyToken, authorizeRoles('patient', 'doctor', 'staff', 'admin'), listClinics);

// Everything below this line is admin-only.
router.use(verifyToken, authorizeRoles('admin'));

router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/dashboard-stats', dashboardStats);
router.post('/clinics', createClinic);
router.put('/clinics/:id', updateClinic);
router.delete('/clinics/:id', deleteClinic);
router.put('/staff/:id/clinics', assignStaffClinics);
router.get('/audit-logs', getAuditLogs);
router.get('/roles', getRolePermissions);
router.put('/roles/:role', updateRolePermissions);
router.get('/records', getAllRecords);
router.put('/records/:id', updateMedicalRecord);
router.delete('/records/:id', deleteMedicalRecord);
// CSV upload runs first; its errors (wrong type, too big) are converted
// into a clean 400 response instead of crashing the request.
router.post('/patients/import', (req, res, next) => {
  csvUpload(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, importPatients);

module.exports = router;
