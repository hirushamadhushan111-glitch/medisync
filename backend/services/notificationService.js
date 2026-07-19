/**
 * OOP Concept: Inheritance + Encapsulation
 *
 * NotificationService extends BaseService for notification CRUD operations.
 * Encapsulates user-scoped queries (findByUser, markRead, markAllRead).
 *
 * createNotification is a standalone helper that handles the full
 * delivery pipeline: database persist → socket emit → email dispatch.
 * It is attached to the singleton for convenient import by other modules.
 */

const BaseService    = require('./BaseService');
const Notification   = require('../models/Notification');
const sendEmail      = require('../utils/sendEmail');
const { NotFoundError } = require('../utils/AppError');

class NotificationService extends BaseService {
  // Bind this service to the Notification model (BaseService provides shared CRUD).
  constructor() {
    super(Notification, 'Notification');
  }

  // ── Retrieve notifications for a specific user ────────────────
  // Day-scoped, like queue tokens: "queue number 5 is being served"
  // from a past day is noise, so only TODAY's notifications are shown
  // (bell + dashboard). Older rows stay in the DB but never display.
  async findByUser(userId) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return Notification.find({ userId, createdAt: { $gte: startOfToday } })
      .sort({ createdAt: -1 })
      .limit(30);
  }

  // ── Mark a single notification as read (user-scoped) ─────────
  async markRead(id, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true },
      { new: true }
    );
    if (!notification) throw new NotFoundError('Notification');
    return notification;
  }

  // ── Mark all unread notifications for a user as read ─────────
  async markAllRead(userId) {
    await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  }
}

const notificationService = new NotificationService();

// ── Delivery helper (socket + email) ─────────────────────────────
// Kept as a standalone function because it coordinates three concerns
// (DB, socket, email) that don't belong on the pure CRUD service.
const createNotification = async ({
  io,
  user,
  userId,
  message,
  type = 'general',
  socketEvent = 'notification',
  socketPayload,
  email,
}) => {
  const recipientId = userId || user?._id;
  const notification = await Notification.create({
    userId: recipientId,
    message,
    type,
    deliveryStatus: 'sent',
    emailDeliveryStatus: email ? 'pending' : 'not-requested',
  });

  io?.to(`user:${recipientId}`).emit(socketEvent, socketPayload || notification);
  if (socketEvent !== 'notification') {
    io?.to(`user:${recipientId}`).emit('notification', notification);
  }

  // Email is dispatched in the background — SMTP can take several seconds
  // and must never delay the API response or queue updates.
  if (email && user?.email) {
    sendEmail({ to: user.email, ...email })
      .then((result) => {
        notification.emailDeliveryStatus = result?.skipped ? 'skipped' : 'sent';
        return notification.save();
      })
      .catch(() => {
        notification.emailDeliveryStatus = 'failed';
        return notification.save().catch(() => {});
      });
  }

  return notification;
};

// Attach utility so callers can: const { createNotification } = require('./notificationService')
notificationService.createNotification = createNotification;

module.exports = notificationService;
module.exports.createNotification = createNotification;
