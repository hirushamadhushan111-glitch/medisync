/**
 * clinicSessionRoutes.js — /api/clinic-sessions/*
 *
 * A ClinicSession is one clinic day (clinic + doctor + date + times).
 * Patients read /upcoming to see today's/tomorrow's bookable sessions;
 * admins create/update/delete sessions (the OPD scheduler job also
 * creates them automatically each day).
 */
const express = require('express');
const { body, param } = require('express-validator');
const {
  getSessions,
  getUpcomingSessions,
  createSession,
  updateSession,
  deleteSession,
} = require('../controllers/clinicSessionController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.use(verifyToken);

router.get('/upcoming', getUpcomingSessions);                    // today/tomorrow cards (any logged-in user)
router.get('/', authorizeRoles('admin', 'staff'), getSessions);  // full schedule list
router.post(
  '/',
  authorizeRoles('admin'),
  body('clinicId').isMongoId().withMessage('A valid clinic is required'),
  body('doctorId').isMongoId().withMessage('A valid doctor is required'),
  body('date').isISO8601().withMessage('A valid date is required'),
  body('startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Use HH:mm time format'),
  body('endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Use HH:mm time format'),
  validateRequest,
  createSession
);
router.put(
  '/:id',
  authorizeRoles('admin'),
  param('id').isMongoId(),
  body('doctorId').optional().isMongoId(),
  body('startTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('endTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('isActive').optional().isBoolean(),
  validateRequest,
  updateSession
);
router.delete(
  '/:id',
  authorizeRoles('admin'),
  param('id').isMongoId(),
  validateRequest,
  deleteSession
);

module.exports = router;
