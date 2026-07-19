/**
 * queueController.js — the live queue engine.
 *
 * Flow: staff generate a token → patient waits (position recalculated
 * live) → doctor calls next / marks served-skipped → everyone is updated
 * through Socket.IO rooms and notifications (in-app + email).
 *
 * Key ideas:
 *  - queueNumber never changes (printed token); position changes live.
 *  - All queue queries are scoped to ONE clinic + ONE day (todayDate).
 *  - After every change: recalculateWaitingQueue → notifyNearTurnPatients
 *    → emitQueueUpdate, so the display and patients stay in sync.
 */
const Queue = require('../models/Queue');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Clinic = require('../models/Clinic');
const Doctor = require('../models/Doctor');
const { createNotification } = require('../services/notificationService');
const { AVG_CONSULTATION_TIME } = require('../utils/constants');

// Midnight of the given day — all queue docs use this as their `date`.
const todayDate = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Attach patient/doctor (with their user info), clinic, and appointment
// to any Queue query — used everywhere a token is returned to the UI.
const queuePopulate = (query) =>
  query
    .populate({ path: 'patientId', populate: { path: 'userId', select: '-password' } })
    .populate({ path: 'doctorId', populate: { path: 'userId', select: '-password' } })
    .populate('clinicId')
    .populate('appointmentId');

// The "live" queue = waiting + serving tokens, in calling order.
const getActiveQueueForClinic = async (clinicId, date = todayDate()) =>
  queuePopulate(
    Queue.find({
      clinicId,
      date,
      status: { $in: ['waiting', 'serving'] },
    })
  ).sort({ position: 1, queueNumber: 1 });

// Re-number every waiting token (1, 2, 3, …) and refresh estimated wait
// times. Called after any change — token added, called, skipped, cancelled.
const recalculateWaitingQueue = async (clinicId, date = todayDate()) => {
  const waiting = await Queue.find({ clinicId, date, status: 'waiting' }).sort({ position: 1, queueNumber: 1 });
  const serving = await Queue.findOne({ clinicId, date, status: 'serving' });
  const offset = serving ? 1 : 0; // position 1 is taken while someone is being served

  await Promise.all(
    waiting.map((item, index) => {
      item.position = index + 1 + offset;
      item.estimatedWaitTime = (index + offset) * AVG_CONSULTATION_TIME;
      return item.save();
    })
  );
};

// "Your turn is near" alert for patients within the first 4 positions.
// findOneAndUpdate with the nearTurnNotifiedAt:null filter acts as a
// claim, so each patient is notified exactly once even under races.
const notifyNearTurnPatients = async (req, clinicId, date = todayDate()) => {
  const candidates = await Queue.find({
    clinicId,
    date,
    status: 'waiting',
    position: { $lte: 4 },
    nearTurnNotifiedAt: null,
  })
    .sort({ position: 1 })
    .populate({ path: 'patientId', populate: { path: 'userId', select: '-password' } });

  await Promise.all(
    candidates.map(async (candidate) => {
      const claimed = await Queue.findOneAndUpdate(
        { _id: candidate._id, nearTurnNotifiedAt: null },
        { nearTurnNotifiedAt: new Date() },
        { new: true }
      );
      if (!claimed || !candidate.patientId?.userId) return;

      const peopleAhead = Math.max(candidate.position - 1, 0);
      const nearTurnMsg =
        peopleAhead === 0
          ? `Queue number ${candidate.queueNumber} is next. Please be ready.`
          : `Queue number ${candidate.queueNumber} is within ${peopleAhead} position${peopleAhead === 1 ? '' : 's'} of being called.`;

      await createNotification({
        io: req.app.get('io'),
        user: candidate.patientId.userId,
        message: nearTurnMsg,
        type: 'queue',
        email: {
          subject: 'MediSync - Your Turn is Coming Soon!',
          text:
            peopleAhead === 0
              ? `Queue number ${candidate.queueNumber}: You are NEXT! Please proceed to the clinic immediately.`
              : `Queue number ${candidate.queueNumber}: Only ${peopleAhead} person${peopleAhead === 1 ? '' : 's'} ahead of you. Please be ready at the clinic!`,
        },
      });
    })
  );
};

// Broadcast the fresh queue to everyone watching this clinic's display.
const emitQueueUpdate = async (req, clinicId, date = todayDate()) => {
  const queue = await getActiveQueueForClinic(clinicId, date);
  req.app.get('io')?.to(`clinic:${clinicId}`).emit('queue:updated', queue);
  return queue;
};

// ── POST /api/queue/generate (staff) ──────────────────────────────
// Issue the next token number for today and reply immediately; emails,
// rebalancing, and broadcasts happen after the response is sent.
const generateQueueToken = async (req, res) => {
  try {
    const { patientId, doctorId, clinicId, appointmentId } = req.body;

    // Step 1: load clinic, patient and doctor at the same time (faster
    // than three separate awaits) and make sure they all exist.
    const [clinic, patient, doctor] = await Promise.all([
      Clinic.findById(clinicId),
      Patient.findById(patientId).populate('userId', '-password'),
      Doctor.findById(doctorId),
    ]);

    if (!clinic || !clinic.isActive) return res.status(404).json({ message: 'Active clinic not found' });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    // Step 2: if the token is linked to a booking, check it exists.
    let appointment = null;
    if (appointmentId) {
      appointment = await Appointment.findById(appointmentId);
      if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    }

    // Step 3: work out the numbers.
    // Next token number = highest issued today + 1.
    const date = todayDate();
    const lastQueue = await Queue.findOne({ clinicId, date }).sort({ queueNumber: -1 });
    const queueNumber = lastQueue ? lastQueue.queueNumber + 1 : 1;
    // Position in line = how many people are already waiting/serving + 1.
    const activeCount = await Queue.countDocuments({ clinicId, date, status: { $in: ['waiting', 'serving'] } });
    const position = activeCount + 1;

    // Step 4: create the token document.
    const queue = await Queue.create({
      clinicId,
      patientId,
      doctorId,
      appointmentId: appointment?._id,
      queueNumber,
      position,
      status: 'waiting',
      estimatedWaitTime: (position - 1) * AVG_CONSULTATION_TIME,
      date,
    });

    // Step 5: reply to the reception desk straight away.
    const populatedQueue = await queuePopulate(Queue.findById(queue._id));
    res.status(201).json({ message: 'Queue token generated successfully', queue: populatedQueue });

    // Step 6: slower work AFTER the response — email the patient,
    // re-number the queue, and broadcast (never delays the desk).
    (async () => {
      await createNotification({
        io: req.app.get('io'),
        user: patient.userId,
        message: `Your queue token is ${queueNumber}.`,
        type: 'queue',
        email: {
          subject: 'MediSync - Your Queue Number',
          text: `Your queue number is ${queueNumber}. Estimated wait time: approximately ${(position - 1) * AVG_CONSULTATION_TIME} minutes. Please stay nearby.`,
        },
      });
      await recalculateWaitingQueue(clinicId, date);
      await notifyNearTurnPatients(req, clinicId, date);
      await emitQueueUpdate(req, clinicId, date);
    })().catch((err) => console.error('[Queue] post-response tasks failed:', err.message));
    return undefined;
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ── GET /api/queue/live/:clinicId (any logged-in role) ───────────
const getLiveQueue = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.clinicId);
    if (!clinic) return res.status(404).json({ message: 'Clinic not found' });

    const queue = await getActiveQueueForClinic(req.params.clinicId);
    return res.json({ queue });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ── PUT /api/queue/next/:clinicId (doctor) ───────────────────────
// Called by the DOCTOR — advances only their own patients in the clinic's
// queue, so one doctor can never pull another doctor's patient.
// Finishing the currently-serving token is implicit: calling "next"
// marks it completed first.
const callNextPatient = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const date = todayDate();

    // Step 1: load the clinic and the calling doctor's own profile.
    const [clinic, doctor] = await Promise.all([
      Clinic.findById(clinicId),
      Doctor.findOne({ userId: req.user._id }),
    ]);
    if (!clinic) return res.status(404).json({ message: 'Clinic not found' });
    if (!doctor) return res.status(404).json({ message: 'Doctor profile not found' });
    // An unavailable doctor must flip their toggle before calling patients.
    if (!doctor.isAvailable) {
      return res.status(409).json({ message: 'You are marked unavailable — switch to available before calling patients' });
    }

    // Step 2: finish the patient currently being served (if any) —
    // their token becomes 'completed' and the linked booking too.
    const currentServing = await Queue.findOne({ clinicId, date, status: 'serving', doctorId: doctor._id });
    if (currentServing) {
      currentServing.status = 'completed';
      currentServing.position = 0;
      currentServing.estimatedWaitTime = 0;
      currentServing.completedAt = new Date();
      await currentServing.save();
      if (currentServing.appointmentId) {
        await Appointment.findByIdAndUpdate(currentServing.appointmentId, { status: 'completed' });
      }
    }

    // Step 3: atomically grab the first waiting token of THIS doctor
    // and flip it to 'serving' (findOneAndUpdate = no race conditions).
    const nextPatient = await queuePopulate(
      Queue.findOneAndUpdate(
        { clinicId, date, status: 'waiting', doctorId: doctor._id },
        { status: 'serving', position: 1, estimatedWaitTime: 0, calledAt: new Date() },
        { new: true, sort: { position: 1, queueNumber: 1 } }
      )
    );

    // Nobody waiting — just refresh the display and say so.
    if (!nextPatient) {
      const queue = await emitQueueUpdate(req, clinicId, date);
      return res.json({ message: 'No waiting patients in the queue', current: null, queue });
    }

    // Step 4: re-number everyone still waiting, then tell the called
    // patient (in-app + email + their personal socket room).
    await recalculateWaitingQueue(clinicId, date);
    const io = req.app.get('io');
    await createNotification({
      io,
      user: nextPatient.patientId.userId,
      message: `Queue number ${nextPatient.queueNumber} is now being served.`,
      type: 'queue',
      socketEvent: 'queue:token_called',
      socketPayload: nextPatient,
      email: {
        subject: 'MediSync Queue Number Called',
        text: `Your queue number ${nextPatient.queueNumber} is now being served at ${clinic.clinicName}. Please proceed immediately.`,
      },
    });

    // Step 5: update every screen — the clinic display hears 'queue:next',
    // near-turn patients get their alert, and the fresh queue is broadcast.
    io?.to(`clinic:${clinicId}`).emit('queue:next', nextPatient);
    await notifyNearTurnPatients(req, clinicId, date);
    const queue = await emitQueueUpdate(req, clinicId, date);
    return res.json({ message: 'Queue advanced successfully', current: nextPatient, queue });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ── PUT /api/queue/status/:id (doctor) ───────────────────────────
// Manually set one token's status (serving / completed / skipped /
// back to waiting) — used by the doctor's queue action buttons.
const updateQueueStatus = async (req, res) => {
  try {
    const { status } = req.body;

    // Step 1: find the token being changed.
    const queue = await Queue.findById(req.params.id);
    if (!queue) return res.status(404).json({ message: 'Queue item not found' });

    // Step 2: doctors may only manage their own patients' tokens.
    const ownDoctor = await Doctor.findOne({ userId: req.user._id });
    if (!ownDoctor || queue.doctorId.toString() !== ownDoctor._id.toString()) {
      return res.status(403).json({ message: 'You can only manage your own patients in the queue' });
    }

    if (status === 'serving') {
      if (!ownDoctor.isAvailable) {
        return res.status(409).json({ message: 'You are marked unavailable — switch to available before serving patients' });
      }
      queue.calledAt = queue.calledAt || new Date();
    }

    // Step 3: apply the new status. Completed/skipped tokens leave the
    // active line, so their position becomes the 0 sentinel.
    queue.status = status;
    if (['completed', 'skipped'].includes(status)) {
      queue.position = 0;
      queue.estimatedWaitTime = 0;
      queue.completedAt = status === 'completed' ? new Date() : queue.completedAt;
    }
    await queue.save();

    // Step 4: if the token was set to 'serving', tell the patient the
    // same way callNextPatient does.
    const populatedQueue = await queuePopulate(Queue.findById(queue._id));
    if (status === 'serving' && populatedQueue.patientId?.userId) {
      const clinic = await Clinic.findById(queue.clinicId);
      await createNotification({
        io: req.app.get('io'),
        user: populatedQueue.patientId.userId,
        message: `Queue number ${populatedQueue.queueNumber} is now being served.`,
        type: 'queue',
        socketEvent: 'queue:token_called',
        socketPayload: populatedQueue,
        email: {
          subject: 'MediSync Queue Number Called',
          text: `Your queue number ${populatedQueue.queueNumber} is now being served at ${clinic?.clinicName || 'the clinic'}.`,
        },
      });
      req.app.get('io')?.to(`clinic:${queue.clinicId}`).emit('queue:next', populatedQueue);
    }

    // Step 5: re-number the line, alert near-turn patients, refresh screens.
    await recalculateWaitingQueue(queue.clinicId, queue.date);
    await notifyNearTurnPatients(req, queue.clinicId, queue.date);
    const activeQueue = await emitQueueUpdate(req, queue.clinicId, queue.date);

    return res.json({ message: 'Queue status updated successfully', queue: populatedQueue, activeQueue });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ── GET /api/queue/my (patient) ──────────────────────────────────
// The patient's own live position: token, people ahead, now serving.
const getMyQueuePosition = async (req, res) => {
  try {
    // Step 1: find the logged-in patient's profile.
    const patient = await Patient.findOne({ userId: req.user._id });
    if (!patient) return res.status(404).json({ message: 'Patient profile not found' });

    // Step 2: collect all of today's still-active tokens for this patient.
    const date = todayDate();
    const tokens = await queuePopulate(
      Queue.find({
        patientId: patient._id,
        date,
        status: { $in: ['waiting', 'serving'] },
      })
    ).sort({ queueNumber: 1 });

    if (!tokens.length) return res.status(404).json({ message: 'No active queue token found for today' });

    // Patient may hold tokens for several clinics today — ?queueId= selects one
    const queue = tokens.find((token) => token._id.toString() === req.query.queueId) || tokens[0];

    // Step 3: who is being served right now, and how many are ahead of me?
    const currentServing = await Queue.findOne({ clinicId: queue.clinicId._id, date, status: 'serving' });
    const peopleAhead = await Queue.countDocuments({
      clinicId: queue.clinicId._id,
      date,
      status: { $in: ['waiting', 'serving'] },
      position: { $gt: 0, $lt: queue.position },
    });

    return res.json({
      queue,
      queueNumber: queue.queueNumber,
      position: queue.position,
      estimatedWaitTime: queue.estimatedWaitTime,
      status: queue.status,
      clinicName: queue.clinicId?.clinicName,
      doctorName: queue.doctorId?.userId?.name,
      doctorAvailable: queue.doctorId?.isAvailable,
      currentServing: currentServing?.queueNumber || null,
      peopleAhead,
      tokens: tokens.map((token) => ({
        _id: token._id,
        queueNumber: token.queueNumber,
        clinicId: token.clinicId?._id,
        clinicName: token.clinicId?.clinicName,
        status: token.status,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ── GET /api/queue/public-clinics (no login) ─────────────────────
// Clinic list for the waiting-room TV display's dropdown.
const getPublicClinics = async (req, res) => {
  try {
    const clinics = await Clinic.find({ isActive: true }).select('clinicName departmentType isActive').sort({ clinicName: 1 });
    return res.json({ clinics });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ── GET /api/queue/public/:clinicId (no login) ───────────────────
// The TV display's data — stripped down to numbers/status only, so no
// patient personal data is ever exposed publicly.
const getPublicQueueDisplay = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.clinicId);
    if (!clinic || !clinic.isActive) return res.status(404).json({ message: 'Active clinic not found' });

    const queue = await getActiveQueueForClinic(req.params.clinicId);
    const sanitized = queue.map((item) => ({
      queueNumber: item.queueNumber,
      status: item.status,
      position: item.position,
      doctorName: item.doctorId?.userId?.name || 'Doctor',
    }));

    return res.json({
      clinicName: clinic.clinicName,
      departmentType: clinic.departmentType,
      queue: sanitized,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  generateQueueToken,
  getLiveQueue,
  getPublicClinics,
  getPublicQueueDisplay,
  callNextPatient,
  updateQueueStatus,
  getMyQueuePosition,
  notifyNearTurnPatients,
  recalculateWaitingQueue,
};
