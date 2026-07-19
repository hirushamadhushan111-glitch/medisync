/**
 * MedicalRecord model — one consultation written by a doctor:
 * symptoms, diagnosis, prescription lines, notes, follow-up info.
 * All doctors can read all records (cross-clinic history), and the
 * prescription/history PDFs are generated from these documents.
 */
const mongoose = require('mongoose');

// One prescription line, e.g. { medicine: 'Metformin', dosage: '500mg x2', duration: '30 days' }.
const prescriptionSchema = new mongoose.Schema(
  {
    medicine: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const medicalRecordSchema = new mongoose.Schema(
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
    // Clinic (or OPD) where the consultation happened. Optional so legacy
    // records stay valid; missing clinicId is displayed as General OPD.
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
    },
    visitDate: {
      type: Date,
      default: Date.now,
    },
    symptoms: {
      type: String,
      required: true,
      trim: true,
    },
    diagnosis: {
      type: String,
      required: true,
      trim: true,
    },
    prescription: {
      type: [prescriptionSchema],
      default: [],
    },
    labReports: [
      {
        name: { type: String, trim: true },
        url: { type: String, trim: true },
        notes: { type: String, trim: true },
      },
    ],
    treatmentNotes: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    followUpInstructions: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    followUpDate: Date,
    doctorComments: {
      type: String,
      trim: true,
    },
    tags: {
      type: [
        {
          type: String,
          trim: true,
          lowercase: true,
          maxlength: 80,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Indexes for the two common queries: one patient's history and
// one doctor's records, both newest-first.
medicalRecordSchema.index({ patientId: 1, visitDate: -1 });
medicalRecordSchema.index({ doctorId: 1, visitDate: -1 });

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
