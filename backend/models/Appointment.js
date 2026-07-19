/**
 * Appointment model — one booking (online or walk-in) for a clinic day.
 *
 * `queueNumber` is the patient's token for that clinic + date; the
 * unique index below guarantees no two patients ever share a token
 * on the same clinic day.
 */
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    appointmentTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm format'],
    },
    bookingType: {
      type: String,
      enum: ['online', 'walk-in'],
      default: 'online',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'confirmed',
    },
    queueNumber: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { timestamps: true }
);

appointmentSchema.index({ clinicId: 1, appointmentDate: 1, queueNumber: 1 }, { unique: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
