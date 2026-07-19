/**
 * Doctor model — the doctor-specific profile linked to a User account
 * (User holds login details; this holds department, specialization and
 * the weekly consultation schedule used to build clinic sessions).
 */
const mongoose = require('mongoose');

// One weekly time slot, e.g. { day: 'Monday', startTime: '08:00', endTime: '17:00' }.
const scheduleSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format'],
    },
    endTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format'],
    },
  },
  { _id: false }
);

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
    },
    consultationSchedule: {
      type: [scheduleSchema],
      default: [],
    },
    // Patients this doctor has treated — added automatically each time
    // the doctor saves a consultation record.
    assignedPatients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
      },
    ],
    // On-duty toggle from the doctor dashboard — shown live on queue displays.
    isAvailable: {
      type: Boolean,
      default: true,
    },
    availabilityUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);
