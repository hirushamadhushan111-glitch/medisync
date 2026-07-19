/**
 * One-time migration: reduce the system to exactly three clinics
 * (General OPD, Diabetic Clinic, Heart (Cardiology) Clinic) and make
 * sure every existing patient is registered to one of them.
 *
 *  1. Keeps (or creates) the three clinics, reusing existing docs when a
 *     clinic of that type already exists (loose alias matching).
 *  2. Deletes every other clinic together with its sessions, queues and
 *     appointments, and removes it from staff assignedClinics.
 *  3. Assigns every patient with no registeredClinics to one of the three
 *     kept clinics (round-robin, so the demo data looks realistic).
 *
 * Usage: node scripts/setupThreeClinics.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Clinic        = require('../models/Clinic');
const ClinicSession = require('../models/ClinicSession');
const Appointment   = require('../models/Appointment');
const Queue         = require('../models/Queue');
const Patient       = require('../models/Patient');
const User          = require('../models/User');

const KEEP = [
  { key: 'opd',        name: 'General OPD',               hours: { start: '08:00', end: '16:00' } },
  { key: 'diabetic',   name: 'Diabetic Clinic',           hours: { start: '08:00', end: '14:00' } },
  { key: 'cardiology', name: 'Heart (Cardiology) Clinic', hours: { start: '08:00', end: '14:00' } },
];

// Same loose matching used by the clinic seeders
const ALIASES = {
  generalopd: 'opd', opd: 'opd', outpatient: 'opd', generalmedicine: 'opd', medical: 'opd',
  diabetic: 'diabetic', diabetes: 'diabetic',
  cardiology: 'cardiology', heart: 'cardiology', heartcardiology: 'cardiology', cardiac: 'cardiology',
};

const normalize = (value) =>
  String(value || '').toLowerCase().replace(/clinic/g, '').replace(/[^a-z]/g, '');

const typeKeyOf = (value) => ALIASES[normalize(value)] || null;

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const allClinics = await Clinic.find();

  // ── 1. Resolve or create the three kept clinics ─────────────────
  const keptByKey = {};
  for (const clinic of allClinics) {
    const key = typeKeyOf(clinic.clinicName) || typeKeyOf(clinic.departmentType);
    if (key && KEEP.some((k) => k.key === key) && !keptByKey[key]) keptByKey[key] = clinic;
  }

  for (const spec of KEEP) {
    let clinic = keptByKey[spec.key];
    if (clinic) {
      clinic.clinicName     = spec.name;
      clinic.departmentType = spec.name;
      clinic.isActive       = true;
      await clinic.save();
      console.log(`✓ kept:    ${spec.name}`);
    } else {
      clinic = await Clinic.create({
        clinicName: spec.name,
        departmentType: spec.name,
        openingHours: spec.hours,
        isActive: true,
        assignedDoctors: [],
      });
      keptByKey[spec.key] = clinic;
      console.log(`+ created: ${spec.name}`);
    }
  }

  const keptIds = KEEP.map((spec) => keptByKey[spec.key]._id);
  const keptIdSet = new Set(keptIds.map(String));

  // ── 2. Remove every other clinic and its dependent data ─────────
  const removeIds = allClinics.filter((c) => !keptIdSet.has(c._id.toString())).map((c) => c._id);

  if (removeIds.length) {
    const [sessions, queues, appointments] = await Promise.all([
      ClinicSession.deleteMany({ clinicId: { $in: removeIds } }),
      Queue.deleteMany({ clinicId: { $in: removeIds } }),
      Appointment.deleteMany({ clinicId: { $in: removeIds } }),
    ]);
    await User.updateMany({}, { $pull: { assignedClinics: { $in: removeIds } } });
    await Patient.updateMany({}, { $pull: { registeredClinics: { $in: removeIds } } });
    await Clinic.deleteMany({ _id: { $in: removeIds } });
    console.log(`- removed ${removeIds.length} clinics ` +
      `(${sessions.deletedCount} sessions, ${queues.deletedCount} queue entries, ${appointments.deletedCount} appointments)`);
  } else {
    console.log('No extra clinics to remove.');
  }

  // ── 3. Register every clinic-less patient (round-robin) ─────────
  const orphans = await Patient.find({
    $or: [{ registeredClinics: { $exists: false } }, { registeredClinics: { $size: 0 } }],
  }).select('_id');

  let index = 0;
  for (const patient of orphans) {
    await Patient.updateOne(
      { _id: patient._id },
      { $set: { registeredClinics: [keptIds[index % keptIds.length]] } }
    );
    index += 1;
  }
  console.log(`✓ registered ${orphans.length} patients across the ${keptIds.length} clinics.`);

  const summary = await Patient.aggregate([
    { $unwind: '$registeredClinics' },
    { $group: { _id: '$registeredClinics', count: { $sum: 1 } } },
  ]);
  for (const spec of KEEP) {
    const row = summary.find((s) => s._id.toString() === keptByKey[spec.key]._id.toString());
    console.log(`   ${spec.name}: ${row ? row.count : 0} patients`);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
};

run().catch((error) => { console.error(error); process.exit(1); });
