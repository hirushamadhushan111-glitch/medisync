/**
 * auditLogger.js — writes one AuditLog row for important actions
 * (user created, appointment cancelled, etc.).
 *
 * Fire-and-forget by design: a logging failure must NEVER break the
 * actual request, so errors are only printed, not thrown.
 */
const AuditLog = require('../models/AuditLog');

// Write one audit row; failures are only logged, never thrown.
const logAudit = async ({ action, performedBy, targetModel, targetId, targetName, details, req }) => {
  try {
    const ip = req?.ip || req?.socket?.remoteAddress || 'unknown';
    await AuditLog.create({ action, performedBy, targetModel, targetId, targetName, details, ip });
  } catch (err) {
    console.error('[AuditLog] Failed to write log:', err.message);
  }
};

module.exports = logAudit;
