/**
 * queueRoutes.js — /api/queue/*
 *
 * Live queue management: staff generate tokens, doctors call the next
 * patient / change token status, patients check their own position, and
 * the public waiting-room display reads the queue without logging in.
 */
const express = require('express');
const { body, param } = require('express-validator');
const {
  generateQueueToken,
  getLiveQueue,
  getPublicClinics,
  getPublicQueueDisplay,
  callNextPatient,
  updateQueueStatus,
  getMyQueuePosition,
} = require('../controllers/queueController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

// Public routes (no login) — used by the waiting-room TV display.
router.get('/public-clinics', getPublicClinics);
router.get(
  '/public/:clinicId',
  param('clinicId').isMongoId().withMessage('Invalid clinic id'),
  validateRequest,
  getPublicQueueDisplay
);

// Everything below needs a logged-in user.
router.use(verifyToken);

router.post(
  '/generate',
  authorizeRoles('staff'),
  body('patientId').isMongoId(),
  body('doctorId').isMongoId(),
  body('clinicId').isMongoId(),
  body('appointmentId').optional().isMongoId(),
  validateRequest,
  generateQueueToken
);
router.get(
  '/live/:clinicId',
  authorizeRoles('patient', 'staff', 'admin', 'doctor'),
  param('clinicId').isMongoId().withMessage('Invalid clinic id'),
  validateRequest,
  getLiveQueue
);
router.put(
  '/next/:clinicId',
  authorizeRoles('doctor'),
  param('clinicId').isMongoId().withMessage('Invalid clinic id'),
  validateRequest,
  callNextPatient
);
router.put(
  '/status/:id',
  authorizeRoles('doctor'),
  param('id').isMongoId().withMessage('Invalid queue id'),
  body('status').isIn(['waiting', 'serving', 'completed', 'skipped']).withMessage('Invalid queue status'),
  validateRequest,
  updateQueueStatus
);
router.get('/my', authorizeRoles('patient'), getMyQueuePosition);

module.exports = router;
