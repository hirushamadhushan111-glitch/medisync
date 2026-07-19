/**
 * OOP Concept: Inheritance + Encapsulation + Polymorphism
 *
 * MedicalReportService extends BaseService.
 * Adds report-specific logic: Cloudinary cleanup on delete,
 * filtering by type, patient-scoped queries.
 */

const BaseService      = require('./BaseService');
const MedicalReport    = require('../models/MedicalReport');
const Patient          = require('../models/Patient');
const { cloudinary }   = require('../config/cloudinary');
const { NotFoundError, ValidationError } = require('../utils/AppError');

class MedicalReportService extends BaseService {
  // Bind this service to the MedicalReport model (BaseService provides shared CRUD).
  constructor() {
    super(MedicalReport, 'Medical Report');
  }

  // ── Upload and save a report ───────────────────────────────────
  async createReport({ patientId, uploadedBy, title, reportType, description, reportDate, file }) {
    if (!file)      throw new ValidationError('No file provided.');
    if (!patientId) throw new ValidationError('Patient ID is required.');
    if (!title)     throw new ValidationError('Report title is required.');

    const patient = await Patient.findById(patientId);
    if (!patient) throw new NotFoundError('Patient');

    const isPdf = file.mimetype === 'application/pdf';

    const report = await this.create({
      patientId,
      uploadedBy,
      title:        title.trim(),
      reportType:   reportType || 'other',
      description:  description?.trim(),
      reportDate:   reportDate || new Date(),
      fileUrl:      file.path,
      fileType:     isPdf ? 'pdf' : 'image',
      fileName:     file.originalname,
      cloudinaryId: file.filename,
    });

    return report.populate('uploadedBy', 'name role');
  }

  // ── Get all reports for a patient ─────────────────────────────
  async getByPatient(patientId, reportType = null) {
    const filter = { patientId };
    if (reportType) filter.reportType = reportType;

    return MedicalReport.find(filter)
      .populate('uploadedBy', 'name role')
      .sort({ reportDate: -1 });
  }

  // ── Get reports for logged-in patient ─────────────────────────
  async getMyReports(userId, reportType = null) {
    const patient = await Patient.findOne({ userId });
    if (!patient) throw new NotFoundError('Patient profile');

    return this.getByPatient(patient._id, reportType);
  }

  // ── Polymorphism: override deleteById to also remove from Cloudinary ──
  async deleteById(id) {
    const report = await MedicalReport.findById(id);
    if (!report) throw new NotFoundError('Medical Report');

    // Encapsulated cleanup logic
    await this._removeFromCloudinary(report);

    await report.deleteOne();
    return { message: 'Report deleted successfully.' };
  }

  // ── Private method (Encapsulation) ────────────────────────────
  async _removeFromCloudinary(report) {
    if (!report.cloudinaryId) return;
    const resourceType = report.fileType === 'pdf' ? 'raw' : 'image';
    try {
      await cloudinary.uploader.destroy(report.cloudinaryId, { resource_type: resourceType });
    } catch {
      // Non-fatal: log but don't throw — report DB entry still removed
      console.warn(`Cloudinary cleanup failed for ${report.cloudinaryId}`);
    }
  }
}

module.exports = new MedicalReportService();
