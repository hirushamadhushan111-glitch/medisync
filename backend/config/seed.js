/**
 * seed.js — one-time startup seeding.
 *
 * Runs on every server start but only inserts what is missing:
 *  - default admin + reception + nurse accounts (demo logins)
 *  - the three demo clinics (only when the Clinic collection is empty)
 * Passwords are bcrypt-hashed exactly like normal registration.
 */
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Clinic = require('../models/Clinic');

const defaultUsers = [
  {
    name: 'System Admin',
    email: 'admin@medisync.lk',
    password: 'Admin@1234',
    role: 'admin',
    phone: '0000000000',
    NIC: '000000000V',
  },
  {
    name: 'OPD Reception',
    email: 'reception@medisync.lk',
    password: 'Staff@1234',
    role: 'staff',
    phone: '0000000001',
    NIC: '000000001V',
    designation: 'Receptionist',
  },
  {
    name: 'OPD Nurse',
    email: 'nurse@medisync.lk',
    password: 'Nurse@1234',
    role: 'staff',
    phone: '0000000002',
    NIC: '000000002V',
    designation: 'Nurse',
  },
];

// The demo system runs with exactly three clinics.
const defaultClinics = [
  {
    clinicName: 'General OPD',
    departmentType: 'General OPD',
    openingHours: { start: '08:00', end: '16:00' },
    isActive: true,
  },
  {
    clinicName: 'Diabetic Clinic',
    departmentType: 'Diabetic Clinic',
    openingHours: { start: '08:00', end: '14:00' },
    isActive: true,
  },
  {
    clinicName: 'Heart (Cardiology) Clinic',
    departmentType: 'Heart (Cardiology) Clinic',
    openingHours: { start: '08:00', end: '14:00' },
    isActive: true,
  },
];

// Insert any missing default accounts (never touches existing users).
const seedDefaultUsers = async () => {
  const emails = defaultUsers.map((user) => user.email);
  const existingUsers = await User.find({ email: { $in: emails } }).select('email');
  const existingEmails = new Set(existingUsers.map((user) => user.email));

  if (existingEmails.size === defaultUsers.length) {
    console.log('Default users already exist - skipping seed');
    return;
  }

  const users = await Promise.all(
    defaultUsers
      .filter((user) => !existingEmails.has(user.email))
      .map(async (user) => ({
        ...user,
        email: user.email.toLowerCase(),
        password: await bcrypt.hash(user.password, 10),
      }))
  );

  await User.insertMany(users);
  console.log('Default users seeded successfully');
};

// Insert the demo clinics — only when the collection is completely empty.
const seedDefaultClinics = async () => {
  const count = await Clinic.countDocuments();
  
  if (count > 0) {
    console.log('Clinics already exist - skipping clinic seed');
    return;
  }

  await Clinic.insertMany(defaultClinics);
  console.log('Default clinics seeded successfully');
};

// Run all seeders in order — called once at server startup.
const runSeeds = async () => {
  await seedDefaultUsers();
  await seedDefaultClinics();
};

module.exports = runSeeds;
