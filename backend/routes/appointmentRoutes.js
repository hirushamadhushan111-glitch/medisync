/**
 * appointmentRoutes.js — /api/appointments/*
 *
 * Booking works two ways (hence the conditional rules below):
 *  - with `sessionId`  → book into a ClinicSession (normal patient flow)
 *  - without it        → doctor/clinic/date/time given explicitly (legacy)
 * Patients book for themselves; staff pass a patientId (walk-ins).
 */
const express = require('express');
const { body, param } = require('express-validator');
const {
  bookAppointment,
  getAppointments,
  getMyAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
} = require('../controllers/appointmentController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.use(verifyToken);

// POST /api/appointments — book. The .if() rules make doctor/clinic/
// date/time compulsory ONLY when no sessionId was sent.
router.post(
  '/',
  authorizeRoles('patient', 'staff'),
  body('sessionId').optional().isMongoId().withMessage('A valid clinic session is required'),
  body('doctorId').if(body('sessionId').not().exists()).isMongoId().withMessage('A valid doctor is required'),
  body('clinicId').if(body('sessionId').not().exists()).isMongoId().withMessage('A valid clinic is required'),
  body('patientId').if((value, { req }) => req.user.role !== 'patient').isMongoId().withMessage('A valid patient is required'),
  body('appointmentDate').if(body('sessionId').not().exists()).isISO8601().withMessage('A valid appointment date is required'),
  body('appointmentTime').if(body('sessionId').not().exists()).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Use HH:mm time format'),
  body('bookingType').optional().isIn(['online', 'walk-in']),
  validateRequest,
  bookAppointment
);
router.get('/', authorizeRoles('admin', 'staff'), getAppointments);        // all appointments (management pages)
router.get('/my', authorizeRoles('patient'), getMyAppointments);           // logged-in patient's own bookings
router.get(
  '/:id',
  authorizeRoles('patient', 'doctor', 'staff', 'admin'),
  param('id').isMongoId(),
  validateRequest,
  getAppointmentById
);
router.put(
  '/:id',
  authorizeRoles('staff', 'admin'),
  param('id').isMongoId(),
  body('status').optional().isIn(['pending', 'confirmed', 'completed', 'cancelled']),
  body('appointmentDate').optional().isISO8601(),
  body('appointmentTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  validateRequest,
  updateAppointment
);
router.delete(
  '/:id',
  authorizeRoles('patient', 'staff', 'admin'),
  param('id').isMongoId(),
  validateRequest,
  cancelAppointment
);

module.exports = router;
