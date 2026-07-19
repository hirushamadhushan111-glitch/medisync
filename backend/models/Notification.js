/**
 * Notification model — one in-app notification for one user (the bell
 * icon). `deliveryStatus` tracks the socket push, `emailDeliveryStatus`
 * tracks the optional email copy. Rows self-delete after 24h (TTL index).
 */
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['appointment', 'queue', 'general'],
      default: 'general',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    emailDeliveryStatus: {
      type: String,
      enum: ['not-requested', 'pending', 'sent', 'failed', 'skipped'],
      default: 'not-requested',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

// TTL: MongoDB auto-deletes each notification 24h after creation, so the
// collection never accumulates (display is day-scoped anyway; with many
// patients, keeping old rows would only waste storage).
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
