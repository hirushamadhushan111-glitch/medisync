const mongoose = require('mongoose');

/**
 * A ClinicSession is one clinic held on one specific day with one doctor.
 * Admin schedules these per day (e.g. 2 clinics per day for the next 7 days).
 * Patients book against a session — never a raw doctor/date/time combination.
 */
const clinicSessionSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    date: {
      type: Date,
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// A clinic can hold several sessions on one day (e.g. OPD morning + afternoon),
// distinguished by start time. Overlap between sessions is rejected in the
// controller/scheduler, not by the index.

clinicSessionSchema.index({ clinicId: 1, date: 1, startTime: 1 }, { unique: true });
clinicSessionSchema.index({ date: 1, isActive: 1 });

module.exports = mongoose.model('ClinicSession', clinicSessionSchema);
