/**
 * OOP Concept: Inheritance + Encapsulation
 *
 * ReportService extends BaseService (Appointment as anchor model).
 * Encapsulates all analytics aggregations behind clear method names.
 * Private helpers _dayBounds() and _reportRange() are encapsulated
 * so callers never deal with date arithmetic directly.
 */

const BaseService   = require('./BaseService');
const Appointment   = require('../models/Appointment');
const Queue         = require('../models/Queue');
const Patient       = require('../models/Patient');
const MedicalRecord = require('../models/MedicalRecord');

class ReportService extends BaseService {
  // Anchor this service to the Appointment model (BaseService provides shared CRUD).
  constructor() {
    super(Appointment, 'Report');
  }

  // ── Private date helpers (Encapsulation) ──────────────────────
  _dayBounds(dateValue) {
    const date  = dateValue ? new Date(dateValue) : new Date();
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end   = new Date(date); end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // Date range for reports: given start/end, or the last 30 days by default.
  _reportRange(query = {}) {
    const end   = query.end   ? new Date(query.end)   : new Date();
    end.setHours(23, 59, 59, 999);
    const start = query.start ? new Date(query.start) : new Date(end);
    if (!query.start) start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  // ── Daily summary counts ──────────────────────────────────────
  async getDailyData(dateValue) {
    const { start, end } = this._dayBounds(dateValue);

    const [appointments, completed, waiting, skipped, records, patientIds] = await Promise.all([
      Appointment.countDocuments({ appointmentDate: { $gte: start, $lte: end } }),
      Queue.countDocuments({ date: { $gte: start, $lte: end }, status: 'completed' }),
      Queue.countDocuments({ date: { $gte: start, $lte: end }, status: 'waiting' }),
      Queue.countDocuments({ date: { $gte: start, $lte: end }, status: 'skipped' }),
      MedicalRecord.countDocuments({ visitDate: { $gte: start, $lte: end } }),
      MedicalRecord.distinct('patientId', { visitDate: { $gte: start, $lte: end } }),
    ]);

    return { appointments, completed, waiting, skipped, totalVisits: records, uniquePatientsSeen: patientIds.length, date: start };
  }

  // ── Queue performance aggregation ─────────────────────────────
  async getQueuePerformance(query = {}) {
    const { start, end } = this._reportRange(query);
    const match = { createdAt: { $gte: start, $lte: end } };

    // Wait time in minutes: if the patient was actually called, use the
    // real gap (calledAt − createdAt); otherwise fall back to the estimate.
    const waitExpr = {
      $cond: [
        { $ne: ['$calledAt', null] },
        { $divide: [{ $subtract: ['$calledAt', '$createdAt'] }, 60000] },
        '$estimatedWaitTime',
      ],
    };

    // Three aggregations run in parallel:
    const [performance, peakHours, totals] = await Promise.all([
      // 1) Per-clinic stats: tokens issued, completed/skipped counts, avg wait.
      Queue.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$clinicId',
            totalTokens: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            skipped:   { $sum: { $cond: [{ $eq: ['$status', 'skipped']   }, 1, 0] } },
            averageWaitTime: { $avg: waitExpr },
          },
        },
        // $lookup = SQL-style join to pull in the clinic's name.
        { $lookup: { from: 'clinics', localField: '_id', foreignField: '_id', as: 'clinic' } },
        { $unwind: '$clinic' },
        { $sort: { totalTokens: -1 } },
      ]),
      // 2) Busiest hours: group queue entries by hour of day, top 8.
      Queue.aggregate([
        { $match: match },
        { $group: { _id: { $hour: '$createdAt' }, entries: { $sum: 1 } } },
        { $sort: { entries: -1, _id: 1 } },
        { $limit: 8 },
      ]),
      // 3) Overall totals across every clinic.
      Queue.aggregate([
        { $match: match },
        { $group: { _id: null, totalQueueEntries: { $sum: 1 }, averageWaitTime: { $avg: waitExpr } } },
      ]),
    ]);

    return {
      performance,
      peakHours: peakHours.map((item) => ({
        hour: item._id,
        label: `${String(item._id).padStart(2, '0')}:00`,
        entries: item.entries,
      })),
      overview: totals[0] || { totalQueueEntries: 0, averageWaitTime: 0 },
      range: { start, end },
    };
  }

  // ── Patient visit statistics ───────────────────────────────────
  async getPatientStats(query = {}) {
    const { start, end } = this._reportRange(query);

    // Five stats gathered in parallel for the Reports page:
    const [totalPatients, genderBreakdown, monthlyVisits, mostVisitedPatients, visitFrequency] = await Promise.all([
      // 1) Total registered patients.
      Patient.countDocuments(),
      // 2) Patients grouped by gender (for the pie chart).
      Patient.aggregate([
        { $group: { _id: '$gender', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // 3) Visits per month within the range (line chart).
      MedicalRecord.aggregate([
        { $match: { visitDate: { $gte: start, $lte: end } } },
        { $group: { _id: { year: { $year: '$visitDate' }, month: { $month: '$visitDate' } }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      // 4) Top 10 most-visited patients, joined with their names/NICs.
      MedicalRecord.aggregate([
        { $match: { visitDate: { $gte: start, $lte: end } } },
        { $group: { _id: '$patientId', visits: { $sum: 1 }, lastVisit: { $max: '$visitDate' } } },
        { $sort: { visits: -1, lastVisit: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'patients', localField: '_id', foreignField: '_id', as: 'patient' } },
        { $unwind: '$patient' },
        { $lookup: { from: 'users', localField: 'patient.userId', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { _id: 1, visits: 1, lastVisit: 1, name: '$user.name', NIC: '$patient.NIC' } },
      ]),
      // 5) How often patients visit: bucket counts (1, 2-3, 4-6, 7-10, 11+ visits).
      MedicalRecord.aggregate([
        { $match: { visitDate: { $gte: start, $lte: end } } },
        { $group: { _id: '$patientId', visits: { $sum: 1 } } },
        {
          $bucket: {
            groupBy: '$visits',
            boundaries: [1, 2, 4, 7, 11, 100000],
            default: 'other',
            output: { patients: { $sum: 1 } },
          },
        },
      ]),
    ]);

    return { totalPatients, genderBreakdown, monthlyVisits, mostVisitedPatients, visitFrequency, range: { start, end } };
  }
}

module.exports = new ReportService();
