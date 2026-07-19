/**
 * MedicalReport model — an uploaded lab report / scan file (PDF or image)
 * belonging to a patient. The file itself is stored in Cloudinary;
 * `fileUrl` + `cloudinaryId` point to it, this document is the metadata.
 */
const mongoose = require('mongoose');

const medicalReportSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    reportType: {
      type: String,
      enum: ['blood_test', 'urine_test', 'xray', 'scan', 'ecg', 'prescription', 'other'],
      default: 'other',
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    reportDate: {
      type: Date,
      default: Date.now,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'image'],
      required: true,
    },
    fileName: {
      type: String,
      trim: true,
    },
    cloudinaryId: {
      type: String,
    },
  },
  { timestamps: true }
);

// Index for listing a patient's reports newest-first.
medicalReportSchema.index({ patientId: 1, reportDate: -1 });
medicalReportSchema.index({ uploadedBy: 1 });

module.exports = mongoose.model('MedicalReport', medicalReportSchema);
