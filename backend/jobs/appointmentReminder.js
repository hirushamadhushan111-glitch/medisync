/**
 * appointmentReminder.js — daily 8:00 AM cron job.
 *
 * Finds every CONFIRMED appointment for tomorrow and sends each patient
 * an in-app notification + reminder email (via notificationService).
 * Failures are logged and never crash the server.
 */
const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const { createNotification } = require('../services/notificationService');
const withDrPrefix = require('../utils/drName');

// Register the daily 8:00 AM reminder cron job (see file header).
const scheduleAppointmentReminders = () => {
  // Runs every day at 8:00 AM — sends reminder for tomorrow's appointments
  cron.schedule('0 8 * * *', async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const start = new Date(tomorrow); start.setHours(0, 0, 0, 0);
      const end   = new Date(tomorrow); end.setHours(23, 59, 59, 999);

      const appointments = await Appointment.find({
        appointmentDate: { $gte: start, $lte: end },
        status: 'confirmed',
      })
        .populate({ path: 'patientId', populate: { path: 'userId', select: '-password' } })
        .populate({ path: 'doctorId',  populate: { path: 'userId', select: '-password' } })
        .populate('clinicId');

      for (const appt of appointments) {
        if (!appt.patientId?.userId) continue;

        const dateStr   = new Date(appt.appointmentDate).toLocaleDateString('en-GB');
        const clinicName  = appt.clinicId?.clinicName || 'the clinic';
        const doctorName  = withDrPrefix(appt.doctorId?.userId?.name) || 'your doctor';

        await createNotification({
          io:      null,
          user:    appt.patientId.userId,
          message: `Reminder: You have an appointment tomorrow at ${appt.appointmentTime}.`,
          type:    'appointment',
          email: {
            subject: 'MediSync - Appointment Reminder for Tomorrow',
            text: `Reminder: You have an appointment tomorrow (${dateStr}) at ${appt.appointmentTime} at ${clinicName} with ${doctorName}. Queue number: ${appt.queueNumber}. Please arrive on time.`,
          },
        });
      }

      console.log(`[Reminder] Sent reminders for ${appointments.length} appointment(s) scheduled tomorrow.`);
    } catch (err) {
      console.error('[Reminder] Failed to send appointment reminders:', err.message);
    }
  });

  console.log('[Reminder] Appointment reminder job scheduled — runs daily at 8:00 AM.');
};

module.exports = scheduleAppointmentReminders;
