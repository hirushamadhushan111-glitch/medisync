/**
 * Patient model — the patient-specific profile linked to a User account
 * (User holds login details; this holds demographics, emergency contact,
 * medical history, and the clinics the patient is registered in).
 */
const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    NIC: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'not-specified'],
      default: 'not-specified',
    },
    age: {
      type: Number,
      min: 0,
      max: 130,
    },
    weight: {
      type: Number, // kilograms
      min: 0,
      max: 500,
    },
    height: {
      type: Number, // centimetres
      min: 0,
      max: 300,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    bloodGroup: {
      type: String,
      enum: ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      default: '',
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relationship: { type: String, trim: true },
    },
    medicalHistory: [
      {
        condition: { type: String, trim: true },
        notes: { type: String, trim: true },
        recordedAt: { type: Date, default: Date.now },
      },
    ],
    // Every patient belongs to at least one clinic; they can only book
    // appointments for clinics they are registered in.
    registeredClinics: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Clinic',
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Patient', patientSchema);
