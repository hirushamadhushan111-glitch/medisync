/**
 * OOP Concept: Service Layer + asyncHandler (Decorator pattern)
 *
 * Controllers are thin — HTTP in, HTTP out.
 * All analytics aggregations are delegated to ReportService.
 * asyncHandler eliminates try/catch boilerplate.
 */

const PDFDocument   = require('pdfkit');
const asyncHandler  = require('../utils/asyncHandler');
const reportService = require('../services/ReportService');

// GET /api/reports/daily
const dailySummary = asyncHandler(async (req, res) => {
  const summary = await reportService.getDailyData(req.query.date);
  res.json({ summary });
});

// GET /api/reports/queue-performance
const queuePerformance = asyncHandler(async (req, res) => {
  const data = await reportService.getQueuePerformance(req.query);
  res.json(data);
});

// GET /api/reports/patient-stats
const patientStats = asyncHandler(async (req, res) => {
  const { range, ...stats } = await reportService.getPatientStats(req.query);
  res.json({ stats, range });
});

// GET /api/reports/export-pdf
const exportPdf = asyncHandler(async (req, res) => {
  const [daily, queueData, patientsData] = await Promise.all([
    reportService.getDailyData(req.query.date),
    reportService.getQueuePerformance(req.query),
    reportService.getPatientStats(req.query),
  ]);

  const document  = new PDFDocument({ margin: 48, size: 'A4' });
  const filename  = `medisync-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  document.pipe(res);

  document.fontSize(20).fillColor('#4c1d95').text('MediSync Management Report');
  document.moveDown(0.3).fontSize(10).fillColor('#475467').text(
    `Reporting period: ${queueData.range.start.toLocaleDateString()} - ${queueData.range.end.toLocaleDateString()}`
  );

  document.moveDown().fontSize(15).fillColor('#172033').text('Daily Patient Visit Report');
  document.fontSize(11)
    .text(`Appointments: ${daily.appointments}`)
    .text(`Consultations recorded: ${daily.totalVisits}`)
    .text(`Unique patients seen: ${daily.uniquePatientsSeen}`)
    .text(`Completed queue entries: ${daily.completed}`)
    .text(`Waiting: ${daily.waiting} | Skipped: ${daily.skipped}`);

  document.moveDown().fontSize(15).text('Queue Performance Report');
  document.fontSize(11)
    .text(`Total queue entries: ${queueData.overview.totalQueueEntries || 0}`)
    .text(`Average wait time: ${Math.round(queueData.overview.averageWaitTime || 0)} minutes`)
    .text(`Peak hour: ${queueData.peakHours[0]?.label || 'No data'}`);
  queueData.performance.slice(0, 8).forEach((item) => {
    document.text(
      `${item.clinic.clinicName}: ${item.totalTokens} entries, ${Math.round(item.averageWaitTime || 0)} min average wait`
    );
  });

  document.moveDown().fontSize(15).text('Patient Visit Statistics');
  document.fontSize(11).text(`Registered patients: ${patientsData.totalPatients}`);
  if (!patientsData.mostVisitedPatients.length) {
    document.text('No consultation visits recorded for this period.');
  } else {
    patientsData.mostVisitedPatients.forEach((patient, index) => {
      document.text(`${index + 1}. ${patient.name} (${patient.NIC}) - ${patient.visits} visits`);
    });
  }

  document.end();
});

module.exports = { dailySummary, queuePerformance, patientStats, exportPdf };
