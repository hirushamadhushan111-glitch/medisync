/**
 * notificationRoutes.js — /api/notifications/*
 * In-app notifications for the logged-in user (bell icon in the navbar).
 */
const express = require('express');
const { getMyNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(verifyToken); // every notification route requires login

router.get('/my', getMyNotifications);
router.put('/read-all', markAllAsRead);
router.put('/read/:id', markAsRead);

module.exports = router;
