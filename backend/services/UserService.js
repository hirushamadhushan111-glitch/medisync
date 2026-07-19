/**
 * OOP Concept: Inheritance + Polymorphism
 *
 * UserService extends BaseService and inherits all CRUD methods.
 * It overrides/adds methods specific to User business logic:
 *   - password hashing before create
 *   - email uniqueness check
 *   - JWT token generation
 */

const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const BaseService   = require('./BaseService');
const User          = require('../models/User');
const { ConflictError, AuthError, NotFoundError, ValidationError } = require('../utils/AppError');
const { isValidEmail, isValidPassword } = require('../utils/validators');

class UserService extends BaseService {
  // Bind this service to the User model (BaseService provides shared CRUD).
  constructor() {
    super(User, 'User'); // call parent constructor (super)
  }

  // ── Override create to hash password ─────────────────────────
  // Polymorphism: overrides BaseService.create()
  async create(data) {
    const { email, password, role, name, NIC, phone } = data;

    if (!email || !password || !role || !name) {
      throw new ValidationError('Name, email, password, and role are required.');
    }
    // QA format rules (see utils/validators.js) — enforced at the service
    // layer too, so every code path that creates a user is covered.
    if (!isValidEmail(email)) throw new ValidationError('Please enter a valid email address.');
    if (!isValidPassword(password)) throw new ValidationError('Password must be at least 6 characters long.');

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) throw new ConflictError('A user with this email already exists.');

    const hashed = await bcrypt.hash(password, 12);
    const user   = await super.create({         // call parent method via super
      name, email: email.toLowerCase(),
      password: hashed, role, NIC, phone,
    });

    return user;
  }

  // ── Login ─────────────────────────────────────────────────────
  async login(email, password) {
    if (!email || !password) {
      throw new ValidationError('Email and password are required.');
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !user.isActive) throw new AuthError('Invalid credentials.');

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new AuthError('Invalid credentials.');

    const token = this._generateToken(user._id);
    const { password: _, ...safeUser } = user.toObject();
    return { token, user: safeUser };
  }

  // ── Change password ───────────────────────────────────────────
  async changePassword(userId, currentPassword, newPassword) {
    // The new password must meet the same QA rule as registration.
    if (!isValidPassword(newPassword)) {
      throw new ValidationError('Password must be at least 6 characters long.');
    }

    const user = await User.findById(userId).select('+password');
    if (!user) throw new NotFoundError('User');

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) throw new AuthError('Current password is incorrect.');

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    return { message: 'Password changed successfully.' };
  }

  // ── Private helper (Encapsulation — _ prefix convention) ─────
  _generateToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    });
  }

  // ── Toggle isActive ───────────────────────────────────────────
  async setActiveStatus(userId, isActive) {
    return this.updateById(userId, { isActive });
  }
}

module.exports = new UserService(); // Singleton pattern
