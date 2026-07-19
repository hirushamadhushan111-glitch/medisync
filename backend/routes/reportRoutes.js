/**
 * reportRoutes.js — /api/reports/* (admin only)
 * Analytics for the admin Reports page: daily summary, queue performance,
 * patient statistics, and a PDF export. Date params are validated as ISO dates.
 */
const express = require('express');
const { query } = require('express-validator');
const { dailySummary, queuePerformance, patientStats, exportPdf } = require('../controllers/reportController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();

router.use(verifyToken, authorizeRoles('admin'));

const dateRangeValidation = [
  query('start').optional().isISO8601().withMessage('Invalid start date'),
  query('end').optional().isISO8601().withMessage('Invalid end date'),
  validateRequest,
];

router.get('/daily', query('date').optional().isISO8601(), validateRequest, dailySummary);
router.get('/queue-performance', ...dateRangeValidation, queuePerformance);
router.get('/patient-stats', ...dateRangeValidation, patientStats);
router.get(
  '/export/pdf',
  query('start').optional().isISO8601().withMessage('Invalid start date'),
  query('end').optional().isISO8601().withMessage('Invalid end date'),
  query('date').optional().isISO8601().withMessage('Invalid report date'),
  validateRequest,
  exportPdf
);

module.exports = router;
