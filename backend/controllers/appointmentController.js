/**
 * OOP Concept: Service Layer + asyncHandler (Decorator pattern)
 *
 * Controllers are thin — HTTP in, HTTP out.
 * asyncHandler eliminates try/catch boilerplate throughout.
 * AppError subclasses replace manual res.status(xxx).json() error responses.
 */

const asyncHandler  = require('../utils/asyncHandler');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/AppError');
const logAudit      = require('../utils/auditLogger');
const isOpenClinic  = require('../utils/openClinic');
const Appointment   = require('../models/Appointment');
const Queue         = require('../models/Queue');
const Patient       = require('../models/Patient');
const Doctor        = require('../models/Doctor');
const Clinic        = require('../models/Clinic');
const ClinicSession = require('../models/ClinicSession');
const { createNotification }    = require('../services/notificationService');
const { notifyNearTurnPatients, recalculateWaitingQueue } = require('./queueController');
const { AVG_CONSULTATION_TIME } = require('../utils/constants');

// Start/end of the given day — used to query one day's data.
const dayBounds = (dateValue) => {
  const date  = dateValue ? new Date(dateValue) : new Date();
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end   = new Date(date); end.setHours(23, 59, 59, 999);
  return { start, end };
};

// Attach patient, doctor (with user info) and clinic to an appointment query.
const populateAppointment = (query) =>
  query
    .populate({ path: 'patientId', populate: { path: 'userId', select: '-password' } })
    .populate({ path: 'doctorId',  populate: { path: 'userId', select: '-password' } })
    .populate('clinicId');

// Broadcast the day's full queue to the clinic's socket room.
const emitQueueUpdate = async (req, clinicId, date) => {
  const { start, end } = dayBounds(date);
  const queue = await Queue.find({ clinicId, date: { $gte: start, $lte: end } })
    .sort({ queueNumber: 1 })
    .populate({ path: 'patientId', populate: { path: 'userId', select: '-password' } })
    .populate({ path: 'doctorId',  populate: { path: 'userId', select: '-password' } })
    .populate('clinicId');
  req.app.get('io')?.to(`clinic:${clinicId}`).emit('queue:updated', queue);
};

// True when the logged-in patient owns the given patient profile.
const patientOwnsProfile = async (req, patientId) => {
  const patient = await Patient.findOne({ userId: req.user._id });
  return patient && patient._id.toString() === patientId.toString();
};

// POST /api/appointments
// Patients book with just a sessionId (today/tomorrow clinic session) —
// doctor, date, and time are derived from the session. Staff walk-in
// bookings may still send doctorId/clinicId/date/time directly.
const bookAppointment = asyncHandler(async (req, res) => {
  const { sessionId, bookingType = 'online', patientId: bodyPatientId } = req.body;
  let { doctorId, clinicId, appointmentDate, appointmentTime } = req.body;

  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (sessionId) {
    // Session booking (the normal patient flow): look the session up…
    const session = await ClinicSession.findById(sessionId);
    if (!session || !session.isActive) throw new NotFoundError('Clinic session');

    // …check it falls on today or tomorrow (the only bookable days)…
    const sessionDay = new Date(session.date); sessionDay.setHours(0, 0, 0, 0);
    const dayAfterTomorrow = new Date(today); dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    if (sessionDay < today || sessionDay >= dayAfterTomorrow) {
      throw new ValidationError('Bookings are only open for today\'s and tomorrow\'s clinics');
    }
    // …and for today's session, make sure it hasn't already finished.
    if (sessionDay.getTime() === today.getTime()) {
      const now = new Date();
      const nowHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (nowHHmm >= session.endTime) throw new ValidationError('This clinic session has already ended for today');
    }

    // The session decides the doctor, clinic, date and time.
    doctorId        = session.doctorId;
    clinicId        = session.clinicId;
    appointmentDate = session.date;
    appointmentTime = session.startTime;
  }

  // By this point (session flow or staff walk-in flow) all four must exist.
  if (!doctorId || !clinicId || !appointmentDate || !appointmentTime) {
    throw new ValidationError('Doctor, clinic, date, and time are required');
  }

  const appointmentDateObj = new Date(appointmentDate);
  if (appointmentDateObj < today) throw new ValidationError('Appointment date must be in the future');

  let patientId = bodyPatientId;
  if (req.user.role === 'patient') {
    // Patients always book for themselves — patientId comes from their own
    // profile, so no separate ownership check is needed.
    const ownProfile = await Patient.findOne({ userId: req.user._id });
    if (!ownProfile) throw new NotFoundError('Patient profile');
    patientId = ownProfile._id;
  }
  if (!patientId) throw new ValidationError('Patient is required');

  const { start, end } = dayBounds(appointmentDate);
  const queueDate = start;

  // One parallel round trip instead of six sequential ones — Atlas latency
  // makes serial awaits the slowest part of booking.
  const [doctor, clinic, patient, existing, lastQueue, activeCount] = await Promise.all([
    Doctor.findById(doctorId),
    Clinic.findById(clinicId),
    Patient.findById(patientId).populate('userId', '-password'),
    Appointment.findOne({
      patientId, clinicId,
      appointmentDate: { $gte: start, $lte: end },
      status: { $in: ['pending', 'confirmed'] },
    }),
    Queue.findOne({ clinicId, date: queueDate }).sort({ queueNumber: -1 }),
    Queue.countDocuments({
      clinicId,
      date:   { $gte: start, $lte: end },
      status: { $in: ['waiting', 'serving'] },
    }),
  ]);

  if (!doctor) throw new NotFoundError('Doctor');
  if (!clinic || !clinic.isActive) throw new NotFoundError('Active clinic');
  if (!patient) throw new NotFoundError('Patient');
  if (existing) throw new ValidationError('You already have a booking for this clinic on this day');

  // Patients can only book clinics they are registered in — General OPD is
  // open to everyone (normal outpatient care needs no clinic registration)
  if (req.user.role === 'patient' && !isOpenClinic(clinic)) {
    // Clinic ids this patient is registered in (as strings for comparison).
    const registered = (patient.registeredClinics || []).map((id) => id.toString());
    if (!registered.includes(clinicId.toString())) {
      throw new ForbiddenError('You can only book appointments for clinics you are registered in');
    }
  }

  // Token number = highest issued for that clinic day + 1;
  // position = people already waiting/serving + 1.
  const queueNumber = lastQueue ? lastQueue.queueNumber + 1 : 1;
  const position    = activeCount + 1;

  // Save the booking and its queue token together — every appointment
  // automatically gets a token for its clinic day.
  const appointment = await Appointment.create({
    patientId, doctorId, clinicId, appointmentDate, appointmentTime,
    bookingType, status: 'confirmed', queueNumber,
  });

  const queue = await Queue.create({
    clinicId, patientId, doctorId,
    appointmentId:     appointment._id,
    queueNumber, position,
    status:            'waiting',
    estimatedWaitTime: (position - 1) * AVG_CONSULTATION_TIME,
    date:              queueDate,
  });

  // Respond immediately — the token is created. Notifications and the live
  // queue broadcast run right after, off the response path, so the desk
  // never waits on them.
  res.status(201).json({ message: 'Appointment booked successfully', appointment, queue });

  (async () => {
    await createNotification({
      io:      req.app.get('io'),
      user:    patient.userId,
      message: `Appointment confirmed. Your queue number is ${queueNumber}.`,
      type:    'appointment',
      email: {
        subject: 'MediSync Appointment Confirmation',
        text:    `Your appointment is confirmed for ${new Date(appointmentDate).toLocaleDateString()} at ${appointmentTime}. Queue number: ${queueNumber}.`,
      },
    });
    await emitQueueUpdate(req, clinicId, appointmentDate);
    await notifyNearTurnPatients(req, clinicId, queueDate);
  })().catch((err) => console.error('[Booking] post-response tasks failed:', err.message));
});

// GET /api/appointments  (?date=YYYY-MM-DD → only that day's appointments)
const getAppointments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.date) {
    const { start, end } = dayBounds(req.query.date);
    filter.appointmentDate = { $gte: start, $lte: end };
  }
  const appointments = await populateAppointment(Appointment.find(filter)).sort({ appointmentDate: -1, appointmentTime: 1 });
  res.json({ appointments });
});

// GET /api/appointments/my
// An appointment is only valid on its clinic day — once that day has passed
// it disappears from the patient's view (came or not). Past visits live in
// Medical History instead.
const getMyAppointments = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ userId: req.user._id });
  if (!patient) throw new NotFoundError('Patient profile');

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const appointments = await populateAppointment(
    Appointment.find({ patientId: patient._id, appointmentDate: { $gte: startOfToday } })
  ).sort({ appointmentDate: 1, appointmentTime: 1 });
  res.json({ appointments });
});

// GET /api/appointments/:id
const getAppointmentById = asyncHandler(async (req, res) => {
  const appointment = await populateAppointment(Appointment.findById(req.params.id));
  if (!appointment) throw new NotFoundError('Appointment');

  if (req.user.role === 'patient' && !(await patientOwnsProfile(req, appointment.patientId._id))) {
    throw new ForbiddenError('Access denied');
  }
  res.json({ appointment });
});

// PUT /api/appointments/:id
const updateAppointment = asyncHandler(async (req, res) => {
  const { status, appointmentDate, appointmentTime } = req.body;
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new NotFoundError('Appointment');

  if (status && !['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
    throw new ValidationError('Invalid appointment status');
  }

  // Apply only the fields that were sent; the rest stay unchanged.
  appointment.status          = status          || appointment.status;
  appointment.appointmentDate = appointmentDate || appointment.appointmentDate;
  appointment.appointmentTime = appointmentTime || appointment.appointmentTime;
  await appointment.save();

  // Keep the queue token in sync with the booking's new status.
  const queueStatus = status === 'completed' ? 'completed' : status === 'cancelled' ? 'skipped' : null;
  if (queueStatus) {
    const queueDoc = await Queue.findOneAndUpdate(
      { appointmentId: appointment._id },
      { status: queueStatus, position: 0, estimatedWaitTime: 0,
        completedAt: queueStatus === 'completed' ? new Date() : undefined },
      { new: true }
    );
    // Shift everyone behind the removed token forward and refresh wait times
    if (queueDoc) await recalculateWaitingQueue(queueDoc.clinicId, queueDoc.date);
  }

  await emitQueueUpdate(req, appointment.clinicId, appointment.appointmentDate);
  res.json({ message: 'Appointment updated successfully', appointment });

  const updatedFor = await Patient.findById(appointment.patientId).populate('userId', 'name');
  logAudit({
    action:      'APPOINTMENT_UPDATE',
    performedBy: req.user._id,
    targetModel: 'Appointment',
    targetId:    appointment._id,
    targetName:  updatedFor?.userId?.name,
    details: {
      status: appointment.status,
      date:   appointment.appointmentDate,
      time:   appointment.appointmentTime,
      updatedBy: req.user.role,
    },
    req,
  });
});

// DELETE /api/appointments/:id
const cancelAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new NotFoundError('Appointment');

  if (req.user.role === 'patient' && !(await patientOwnsProfile(req, appointment.patientId._id || appointment.patientId))) {
    throw new ForbiddenError('Patients can only cancel their own appointments');
  }

  // Mark the booking cancelled and take its queue token out of the line.
  appointment.status = 'cancelled';
  await appointment.save();
  const queueDoc = await Queue.findOneAndUpdate(
    { appointmentId: appointment._id },
    { status: 'skipped', position: 0, estimatedWaitTime: 0 },
    { new: true }
  );
  // Shift everyone behind the cancelled token forward and refresh wait times
  if (queueDoc) await recalculateWaitingQueue(queueDoc.clinicId, queueDoc.date);
  await emitQueueUpdate(req, appointment.clinicId, appointment.appointmentDate);

  // Notify doctor when patient cancels
  if (req.user.role === 'patient') {
    const [doctor, patient, clinic] = await Promise.all([
      Doctor.findById(appointment.doctorId).populate('userId', '-password'),
      Patient.findById(appointment.patientId).populate('userId', '-password'),
      Clinic.findById(appointment.clinicId),
    ]);
    if (doctor?.userId) {
      const apptDate = new Date(appointment.appointmentDate).toLocaleDateString('en-GB');
      await createNotification({
        io:      req.app.get('io'),
        user:    doctor.userId,
        message: `Appointment cancelled by patient ${patient?.userId?.name || 'Unknown'} for ${apptDate} at ${appointment.appointmentTime}.`,
        type:    'appointment',
        email: {
          subject: 'MediSync - Appointment Cancelled by Patient',
          text:    `Patient ${patient?.userId?.name || 'Unknown'} has cancelled their appointment scheduled for ${apptDate} at ${appointment.appointmentTime} at ${clinic?.clinicName || 'the clinic'}.`,
        },
      });
    }
  }

  res.json({ message: 'Appointment cancelled successfully' });

  const cancelledFor = await Patient.findById(appointment.patientId).populate('userId', 'name');
  logAudit({
    action:      'APPOINTMENT_CANCEL',
    performedBy: req.user._id,
    targetModel: 'Appointment',
    targetId:    appointment._id,
    targetName:  cancelledFor?.userId?.name,
    details: {
      date: appointment.appointmentDate,
      time: appointment.appointmentTime,
      cancelledBy: req.user.role,
    },
    req,
  });
});

module.exports = { bookAppointment, getAppointments, getMyAppointments, getAppointmentById, updateAppointment, cancelAppointment };
