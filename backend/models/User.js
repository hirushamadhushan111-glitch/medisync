/**
 * User model — one login account for every person in the system.
 *
 * The `role` field decides what the account can do (patient / doctor /
 * staff / admin). Role-specific data lives in separate profile models
 * (Patient.js, Doctor.js) linked back to this user by `userId`.
 *
 * `password` uses `select: false` so it is NEVER returned by queries
 * unless explicitly requested with .select('+password') at login.
 */
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['patient', 'doctor', 'staff', 'admin'],
      default: 'patient',
    },
    designation: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    phone: {
      type: String,
      trim: true,
      required: [true, 'Phone is required'],
      maxlength: 30,
    },
    NIC: {
      type: String,
      trim: true,
      required: [true, 'NIC is required'],
      unique: true,
      maxlength: 30,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    // Staff only — the clinics this staff member manages.
    assignedClinics: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Clinic',
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('User', userSchema);
