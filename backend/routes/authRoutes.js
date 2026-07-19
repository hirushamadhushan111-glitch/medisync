/**
 * authRoutes.js — /api/auth/*
 *
 * Login, account creation (staff/admin only), current-user info,
 * own-profile read/update, and avatar upload.
 */
const express = require('express');
const { body } = require('express-validator');
const { createUser, login, getMe, getMyProfile, updateMyProfile, uploadAvatarHandler } = require('../controllers/authController');
const { verifyToken, allowAccountCreation } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const { uploadAvatar } = require('../config/cloudinary');

const router = express.Router();

// QA standard rules (must match utils/validators.js): valid email,
// password ≥ 6 chars, phone exactly 10 digits, Sri Lankan NIC.
const createUserRules = [
  body('email').trim().isEmail().withMessage('A valid email address is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('phone').trim().matches(/^\d{10}$/).withMessage('Phone number must be exactly 10 digits'),
  body('NIC').trim().matches(/^(\d{12}|\d{9}[Vv])$/)
    .withMessage("NIC must be exactly 12 digits, or 9 digits ending with the letter 'V'"),
];

router.post('/login', login);                    // public — everything else needs a token
router.post('/create-user', verifyToken, allowAccountCreation, createUserRules, validateRequest, createUser);
router.get('/me', verifyToken, getMe);           // who am I (used on page refresh)
router.get('/profile', verifyToken, getMyProfile);
router.put('/profile', verifyToken, updateMyProfile);
router.post('/avatar', verifyToken, uploadAvatar, uploadAvatarHandler);

module.exports = router;
