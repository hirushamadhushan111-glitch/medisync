/**
 * OOP Concept: Service Layer + asyncHandler (Decorator pattern)
 *
 * Clinic sessions are day-scheduled clinics (clinic + doctor + date + hours).
 * Admin schedules them; patients see only today's and tomorrow's sessions
 * and book directly against a session.
 */

const asyncHandler = require('../utils/asyncHandler');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/AppError');
const ClinicSession = require('../models/ClinicSession');
const Clinic        = require('../models/Clinic');
const Doctor        = require('../models/Doctor');
const Queue         = require('../models/Queue');
const Patient       = require('../models/Patient');
const { createNotification } = require('../services/notificationService');
const { clinicScheduleEmail } = require('../utils/emailTemplates');
const withDrPrefix  = require('../utils/drName');
const isOpenClinic  = require('../utils/openClinic');

// Midnight of the given date — sessions are stored per day.
const startOfDay = (dateValue) => {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Attach clinic + doctor (with user info) to a session query.
const populateSession = (query) =>
  query
    .populate('clinicId')
    .populate({ path: 'doctorId', populate: { path: 'userId', select: '-password' } });

// A doctor cannot run two overlapping sessions on the same day, even when
// they belong to different clinics. HH:mm strings compare correctly.
const assertDoctorFree = async ({ doctorId, date, startTime, endTime, excludeId }) => {
  const filter = {
    doctorId,
    date,
    startTime: { $lt: endTime },
    endTime:   { $gt: startTime },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const clash = await ClinicSession.findOne(filter).populate('clinicId', 'clinicName');
  if (clash) {
    throw new ConflictError(
      `This doctor is already scheduled for ${clash.clinicId?.clinicName || 'another clinic'} from ${clash.startTime} to ${clash.endTime} that day`
    );
  }
};

// GET /api/clinic-sessions?from=&to=   (admin/staff — scheduler view)
const getSessions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = startOfDay(req.query.from);
    if (req.query.to) {
      const to = startOfDay(req.query.to);
      to.setHours(23, 59, 59, 999);
      filter.date.$lte = to;
    }
  }
  const sessions = await populateSession(ClinicSession.find(filter)).sort({ date: 1, startTime: 1 });
  res.json({ sessions });
});

// GET /api/clinic-sessions/upcoming   (patients — today & tomorrow only)
const getUpcomingSessions = asyncHandler(async (req, res) => {
  const today    = startOfDay(new Date());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfTomorrow = new Date(tomorrow); endOfTomorrow.setHours(23, 59, 59, 999);

  const sessions = await populateSession(
    ClinicSession.find({ isActive: true, date: { $gte: today, $lte: endOfTomorrow } })
  ).sort({ date: 1, startTime: 1 });

  // Patients only see sessions of clinics they are registered in — except
  // General OPD, which is open to every patient. Staff/admin see everything.
  let registeredIds = null;
  if (req.user.role === 'patient') {
    const patient = await Patient.findOne({ userId: req.user._id }).select('registeredClinics');
    registeredIds = new Set((patient?.registeredClinics || []).map((id) => id.toString()));
  }

  const active = sessions.filter(
    (s) => s.clinicId?.isActive
      && (!registeredIds || registeredIds.has(s.clinicId._id.toString()) || isOpenClinic(s.clinicId))
  );

  // Attach live booking count so patients can see how full each session is
  const withCounts = await Promise.all(
    active.map(async (session) => {
      const dayStart = startOfDay(session.date);
      const dayEnd   = new Date(dayStart); dayEnd.setHours(23, 59, 59, 999);
      const bookedCount = await Queue.countDocuments({
        clinicId: session.clinicId._id,
        date:     { $gte: dayStart, $lte: dayEnd },
        status:   { $in: ['waiting', 'serving'] },
      });
      return { ...session.toObject(), bookedCount };
    })
  );

  res.json({ sessions: withCounts });
});

// POST /api/clinic-sessions   (admin)
const createSession = asyncHandler(async (req, res) => {
  const { clinicId, doctorId, date, startTime, endTime } = req.body;
  if (!clinicId || !doctorId || !date || !startTime || !endTime) {
    throw new ValidationError('Clinic, doctor, date, start time, and end time are required');
  }

  const sessionDate = startOfDay(date);
  const today = startOfDay(new Date());
  if (sessionDate < today) throw new ValidationError('Session date cannot be in the past');
  if (endTime <= startTime) throw new ValidationError('End time must be after start time');

  const clinic = await Clinic.findById(clinicId);
  if (!clinic || !clinic.isActive) throw new NotFoundError('Active clinic');

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new NotFoundError('Doctor');

  // A clinic may run several sessions per day (e.g. OPD morning + afternoon),
  // but their time windows must not overlap. HH:mm strings compare correctly.
  const overlap = await ClinicSession.findOne({
    clinicId,
    date:      sessionDate,
    startTime: { $lt: endTime },
    endTime:   { $gt: startTime },
  });
  if (overlap) {
    throw new ConflictError(
      `This clinic already has a session from ${overlap.startTime} to ${overlap.endTime} that day`
    );
  }

  await assertDoctorFree({ doctorId, date: sessionDate, startTime, endTime });

  const session = await ClinicSession.create({ clinicId, doctorId, date: sessionDate, startTime, endTime });
  await session.populate([
    { path: 'clinicId' },
    { path: 'doctorId', populate: { path: 'userId', select: '-password' } },
  ]);

  // Scheduling a doctor also assigns them to the clinic, so the clinic's
  // assigned-doctors list reflects who actually works there
  await Clinic.updateOne({ _id: clinicId }, { $addToSet: { assignedDoctors: doctorId } });

  res.status(201).json({ message: 'Clinic session scheduled successfully', session });

  // Notify the doctor (in-app + styled email); failures must not affect the response
  const doctorUser = session.doctorId?.userId;
  if (doctorUser) {
    const doctorName = withDrPrefix(doctorUser.name) || 'Doctor';
    const clinicName = session.clinicId?.clinicName || 'a clinic';
    const dateStr = new Date(session.date).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    createNotification({
      io: req.app.get('io'),
      user: doctorUser,
      message: `You have been scheduled for ${clinicName} on ${dateStr}, ${session.startTime} – ${session.endTime}.`,
      type: 'general',
      email: {
        subject: `MediSync — You are scheduled for ${clinicName} on ${dateStr}`,
        text: `Dear ${doctorName}, you have been scheduled to conduct ${clinicName} on ${dateStr} from ${session.startTime} to ${session.endTime}. If you are unavailable, please inform the hospital administration.`,
        html: clinicScheduleEmail({ doctorName, clinicName, dateStr, startTime: session.startTime, endTime: session.endTime }),
      },
    }).catch((err) => console.error('[ClinicSession] Doctor notification failed:', err.message));
  }
});

// PUT /api/clinic-sessions/:id   (admin)
const updateSession = asyncHandler(async (req, res) => {
  const session = await ClinicSession.findById(req.params.id);
  if (!session) throw new NotFoundError('Clinic session');

  // Apply only the fields that were sent (partial update).
  const { doctorId, startTime, endTime, isActive } = req.body;
  if (doctorId !== undefined) {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) throw new NotFoundError('Doctor');
    session.doctorId = doctorId;
  }
  if (startTime !== undefined) session.startTime = startTime;
  if (endTime   !== undefined) session.endTime   = endTime;
  if (isActive  !== undefined) session.isActive  = isActive;
  if (session.endTime <= session.startTime) throw new ValidationError('End time must be after start time');

  // Re-check the doctor isn't double-booked at the new time
  // (excluding this session itself from the overlap check).
  await assertDoctorFree({
    doctorId:  session.doctorId,
    date:      session.date,
    startTime: session.startTime,
    endTime:   session.endTime,
    excludeId: session._id,
  });

  await session.save();
  await session.populate([
    { path: 'clinicId' },
    { path: 'doctorId', populate: { path: 'userId', select: '-password' } },
  ]);

  res.json({ message: 'Clinic session updated successfully', session });
});

// DELETE /api/clinic-sessions/:id   (admin)
const deleteSession = asyncHandler(async (req, res) => {
  const session = await ClinicSession.findById(req.params.id);
  if (!session) throw new NotFoundError('Clinic session');
  await session.deleteOne();
  res.json({ message: 'Clinic session removed successfully' });
});

module.exports = { getSessions, getUpcomingSessions, createSession, updateSession, deleteSession };
