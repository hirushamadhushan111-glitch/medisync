/**
 * Queue model — one live queue token for a clinic day.
 *
 * `queueNumber` is the printed token number (fixed for the day);
 * `position` is the token's current place in the waiting line and is
 * recalculated when patients are called, skipped, or cancelled.
 * The unique index prevents duplicate token numbers per clinic per day.
 */
const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      required: true,
    },
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
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    queueNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    position: {
      type: Number,
      required: true,
      // 0 is a sentinel for completed/skipped tokens that have left the
      // active waiting/serving order (set in queueController).
      min: 0,
    },
    status: {
      type: String,
      enum: ['waiting', 'serving', 'completed', 'skipped'],
      default: 'waiting',
    },
    estimatedWaitTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
    },
    calledAt: Date,            // when staff called this token to the doctor
    completedAt: Date,         // when the consultation finished
    nearTurnNotifiedAt: Date,  // when the "your turn is near" email/notification went out
  },
  { timestamps: true }
);

queueSchema.index({ clinicId: 1, date: 1, queueNumber: 1 }, { unique: true });
queueSchema.index({ doctorId: 1, date: 1, status: 1, position: 1 });

module.exports = mongoose.model('Queue', queueSchema);
