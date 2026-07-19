/**
 * OOP Concept: Service Layer + asyncHandler (Decorator pattern)
 *
 * Controllers are thin — HTTP in, HTTP out.
 * All database logic is delegated to NotificationService.
 * asyncHandler eliminates try/catch boilerplate throughout.
 */

const asyncHandler          = require('../utils/asyncHandler');
const notificationService   = require('../services/notificationService');

// GET /api/notifications
const getMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await notificationService.findByUser(req.user._id);
  res.json({ notifications });
});

// PUT /api/notifications/:id/read
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markRead(req.params.id, req.user._id);
  res.json({ message: 'Notification marked as read', notification });
});

// PUT /api/notifications/read-all
const markAllAsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user._id);
  res.json({ message: 'All notifications marked as read' });
});

module.exports = { getMyNotifications, markAsRead, markAllAsRead };
