/**
 * OPD weekly timetable auto-scheduler.
 *
 * The General OPD clinic runs on a fixed weekly timetable, so its sessions
 * are generated automatically instead of the admin scheduling them by hand:
 *
 *   Monday–Friday : 09:00–12:00  and  13:00–17:00
 *   Saturday      : 09:00–12:00
 *   Sunday        : 09:00–11:00
 *
 * ensureOpdSessions() tops up the next 7 days, skipping any day/slot that
 * already has an overlapping OPD session (so manual scheduling still wins).
 * It runs at server start and every night at 00:05.
 */

const cron = require('node-cron');
const Clinic        = require('../models/Clinic');
const ClinicSession = require('../models/ClinicSession');
const Doctor        = require('../models/Doctor');

// 0 = Sunday … 6 = Saturday
const WEEKDAY_SLOTS = [
  { start: '09:00', end: '12:00' },
  { start: '13:00', end: '17:00' },
];
const WEEKLY_TIMETABLE = {
  0: [{ start: '09:00', end: '11:00' }], // Sunday
  1: WEEKDAY_SLOTS,
  2: WEEKDAY_SLOTS,
  3: WEEKDAY_SLOTS,
  4: WEEKDAY_SLOTS,
  5: WEEKDAY_SLOTS,
  6: [{ start: '09:00', end: '12:00' }], // Saturday
};

const DAYS_AHEAD = 7;

// Pick doctors to staff the OPD (General Medicine first, then fallbacks).
const findOpdDoctors = async (opd) => {
  // Prefer General Medicine doctors (the department that staffs the OPD),
  // then the clinic's assigned doctors, then any doctor in the system.
  let doctors = await Doctor.find({ department: /general\s*medicine/i });
  if (!doctors.length && opd.assignedDoctors?.length) {
    doctors = await Doctor.find({ _id: { $in: opd.assignedDoctors } });
  }
  if (!doctors.length) doctors = await Doctor.find();
  return doctors;
};

// Top up the next 7 days of OPD sessions from the weekly timetable.
const ensureOpdSessions = async () => {
  const opd = await Clinic.findOne({
    isActive: true,
    $or: [{ clinicName: /opd/i }, { departmentType: /opd/i }],
  });
  if (!opd) {
    console.log('[OPD Scheduler] No active OPD clinic found — skipping.');
    return;
  }

  const doctors = await findOpdDoctors(opd);
  if (!doctors.length) {
    console.log('[OPD Scheduler] No doctors registered — cannot schedule OPD sessions.');
    return;
  }

  let created = 0;
  for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);

    const slots = WEEKLY_TIMETABLE[date.getDay()] || [];
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const slot = slots[slotIndex];

      // Skip if any existing OPD session overlaps this slot's window
      const overlap = await ClinicSession.findOne({
        clinicId:  opd._id,
        date,
        startTime: { $lt: slot.end },
        endTime:   { $gt: slot.start },
      });
      if (overlap) continue;

      // Rotate doctors so one doctor is not booked for the whole week
      const doctor = doctors[(offset + slotIndex) % doctors.length];
      await ClinicSession.create({
        clinicId:  opd._id,
        doctorId:  doctor._id,
        date,
        startTime: slot.start,
        endTime:   slot.end,
      });
      await Clinic.updateOne({ _id: opd._id }, { $addToSet: { assignedDoctors: doctor._id } });
      created += 1;
    }
  }

  console.log(
    created
      ? `[OPD Scheduler] Created ${created} OPD session(s) for the next ${DAYS_AHEAD} days.`
      : '[OPD Scheduler] OPD timetable already up to date.'
  );
};

// Run once at startup, then every night at 00:05 (cron).
const scheduleOpdSessions = () => {
  // syncIndexes drops the old one-session-per-clinic-per-day unique index
  // so weekday morning + afternoon OPD sessions can coexist.
  ClinicSession.syncIndexes()
    .then(ensureOpdSessions)
    .catch((err) => console.error('[OPD Scheduler] Startup run failed:', err.message));

  cron.schedule('5 0 * * *', () =>
    ensureOpdSessions().catch((err) => console.error('[OPD Scheduler] Daily run failed:', err.message))
  );
  console.log('[OPD Scheduler] OPD weekly timetable job scheduled — runs daily at 00:05.');
};

module.exports = { scheduleOpdSessions, ensureOpdSessions };
