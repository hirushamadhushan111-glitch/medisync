/**
 * AuditLog model — a permanent trail of "who did what, when".
 *
 * Rows are written by utils/auditLogger.js after important actions
 * (never updated or deleted). The admin Audit Log page reads them
 * newest-first, hence the createdAt index below.
 */
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'USER_CREATE', 'USER_DELETE', 'USER_UPDATE', 'ROLE_CHANGE', 'STATUS_CHANGE',
        'APPOINTMENT_CANCEL', 'APPOINTMENT_UPDATE',
        'CLINIC_CREATE', 'CLINIC_UPDATE', 'CLINIC_DELETE',
        'STAFF_CLINIC_ASSIGN',
        'BULK_IMPORT',
        'RECORD_UPDATE', 'RECORD_DELETE',
        'ROLE_PERMISSIONS_UPDATE',
      ],
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetModel: { type: String },
    targetId:    { type: mongoose.Schema.Types.ObjectId },
    targetName:  { type: String },
    details:     { type: mongoose.Schema.Types.Mixed },
    ip:          { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ performedBy: 1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
