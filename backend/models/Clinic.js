/**
 * Clinic model — one government-hospital clinic (e.g. General OPD).
 *
 * `departmentType` links to the department list in the frontend
 * (utils/departments.js). Patients register into clinics, doctors are
 * assigned to them, and daily ClinicSessions are created per clinic.
 * Inactive clinics (isActive: false) are hidden from booking.
 */
const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema(
  {
    clinicName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    departmentType: {
      type: String,
      required: true,
      trim: true,
    },
    assignedDoctors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
      },
    ],
    openingHours: {
      start: {
        type: String,
        required: true,
        default: '08:00',
        match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format'],
      },
      end: {
        type: String,
        required: true,
        default: '17:00',
        match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format'],
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Clinic', clinicSchema);
