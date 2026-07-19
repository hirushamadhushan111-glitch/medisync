// adminController.js — all admin-only endpoints (/api/admin/...):
// user management, clinics, audit logs, CSV import, roles matrix,
// and medical-record oversight. Every change is logged via logAudit().
const { parse }      = require('csv-parse/sync');
const bcrypt         = require('bcryptjs');
const asyncHandler   = require('../utils/asyncHandler');
const adminService   = require('../services/AdminService');
const clinicService  = require('../services/ClinicService');
const User           = require('../models/User');
const Patient        = require('../models/Patient');
const AuditLog       = require('../models/AuditLog');
const MedicalRecord  = require('../models/MedicalRecord');
const Clinic         = require('../models/Clinic');
const RolePermission = require('../models/RolePermission');
const logAudit       = require('../utils/auditLogger');
const { NotFoundError, ValidationError } = require('../utils/AppError');
const {
  PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  MANAGEABLE_ROLES,
  invalidatePermissionCache,
} = require('../config/permissions');

// ── GET /api/admin/users ──────────────────────────────────────────
// Full user list for the User Management page.
const getUsers = asyncHandler(async (req, res) => {
  const users = await adminService.findAll();
  res.json({ users });
});

// ── PUT /api/admin/users/:id ──────────────────────────────────────
const updateUser = asyncHandler(async (req, res) => {

  // Safety guards: an admin cannot lock themselves out by deactivating
  // their own account or changing their own role.

  const isSelf = req.params.id === req.user._id.toString();
  if (isSelf && req.body.isActive === false) {
    throw new ValidationError('You cannot deactivate your own account');
  }
  if (isSelf && req.body.role !== undefined && req.body.role !== req.user.role) {
    throw new ValidationError('You cannot change your own role');
  }

  // Snapshot the old values first so the audit log can show before/after.

  const before = await User.findById(req.params.id).select('name email role isActive');
  const user   = await adminService.updateUser(req.params.id, req.body);
  res.json({ message: 'User updated successfully', user });

  // Pick the audit action name based on what actually changed.
  
  const action = req.body.role !== undefined       ? 'ROLE_CHANGE'
    : req.body.isActive !== undefined              ? 'STATUS_CHANGE'
    : 'USER_UPDATE';

  logAudit({
    action,
    performedBy: req.user._id,
    targetModel: 'User',
    targetId:    user._id,
    targetName:  user.name,
    details: {
      before: { role: before?.role, isActive: before?.isActive },
      after:  { role: user.role,   isActive: user.isActive },
    },
    req,
  });
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────
const deleteUser = asyncHandler(async (req, res) => {
  // Same self-protection: you cannot delete the account you are using.
  if (req.params.id === req.user._id.toString()) {
    throw new ValidationError('You cannot delete your own account');
  }

  // Grab the name/email before deleting so the audit log can record them.
  const target = await User.findById(req.params.id).select('name email role');
  await adminService.deleteUser(req.params.id);
  res.json({ message: 'User deleted successfully' });

  logAudit({
    action:      'USER_DELETE',
    performedBy: req.user._id,
    targetModel: 'User',
    targetId:    req.params.id,
    targetName:  target?.name,
    details:     { email: target?.email, role: target?.role },
    req,
  });
});

// ── GET /api/admin/dashboard-stats ───────────────────────────────
// Counts (patients, doctors, today's appointments…) for the admin
// dashboard stat cards. The heavy lifting lives in AdminService.
const dashboardStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getDashboardStats();
  res.json({ stats });
});

// ── GET /api/admin/clinics ────────────────────────────────────────
// All clinics for the Clinic Management page.
const listClinics = asyncHandler(async (req, res) => {
  const clinics = await clinicService.findAll();
  res.json({ clinics });
});

// ── POST /api/admin/clinics ───────────────────────────────────────
const createClinic = asyncHandler(async (req, res) => {
  const clinic = await clinicService.createClinic(req.body);
  res.status(201).json({ message: 'Clinic created successfully', clinic });

  logAudit({
    action:      'CLINIC_CREATE',
    performedBy: req.user._id,
    targetModel: 'Clinic',
    targetId:    clinic._id,
    targetName:  clinic.clinicName,
    details:     { departmentType: clinic.departmentType },
    req,
  });
});

// ── PUT /api/admin/clinics/:id ────────────────────────────────────
const updateClinic = asyncHandler(async (req, res) => {
  const clinic = await clinicService.updateClinic(req.params.id, req.body);
  res.json({ message: 'Clinic updated successfully', clinic });

  logAudit({
    action:      'CLINIC_UPDATE',
    performedBy: req.user._id,
    targetModel: 'Clinic',
    targetId:    clinic._id,
    targetName:  clinic.clinicName,
    details:     req.body,
    req,
  });
});

// ── DELETE /api/admin/clinics/:id ─────────────────────────────────
const deleteClinic = asyncHandler(async (req, res) => {
  // Look the clinic up first so the audit log still knows its name.
  const clinic = await clinicService.findById(req.params.id);
  await clinicService.deleteById(req.params.id);
  res.json({ message: 'Clinic deleted successfully' });

  logAudit({
    action:      'CLINIC_DELETE',
    performedBy: req.user._id,
    targetModel: 'Clinic',
    targetId:    req.params.id,
    targetName:  clinic?.clinicName,
    req,
  });
});

// ── PUT /api/admin/staff/:id/clinics ─────────────────────────────
// Sets which clinics a staff member works in (controls what they see
// on the Queue Management / Clinic Patients pages).
const assignStaffClinics = asyncHandler(async (req, res) => {
  const { clinicIds } = req.body;
  if (!Array.isArray(clinicIds)) throw new ValidationError('clinicIds must be an array');

  const user = await User.findById(req.params.id);
  if (!user) throw new NotFoundError('User');
  if (user.role !== 'staff') throw new ValidationError('Only staff accounts can be assigned to clinics');

  // Replace the whole assignment list, then return it with clinic
  // names filled in so the UI can show them straight away.
  const before = [...(user.assignedClinics || [])];
  user.assignedClinics = clinicIds;
  await user.save();
  await user.populate('assignedClinics', 'clinicName departmentType');

  res.json({ message: 'Clinic assignment updated', user });

  logAudit({
    action:      'STAFF_CLINIC_ASSIGN',
    performedBy: req.user._id,
    targetModel: 'User',
    targetId:    user._id,
    targetName:  user.name,
    details:     { before: before.map(String), after: clinicIds.map(String) },
    req,
  });
});

// ── GET /api/admin/audit-logs ─────────────────────────────────────
// Paginated audit trail with optional filters: action type,
// date range, and a free-text search.
const getAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, action, from, to, search } = req.query;

  // Build the Mongo filter piece by piece from whatever was supplied.
  const filter = {};
  if (action)       filter.action = action;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to)   filter.createdAt.$lte = new Date(`${to}T23:59:59`); // include the whole "to" day
  }

  // Search matches either the person who did the action (by name)
  // or the name of the thing the action was done to.
  let performedByIds;
  if (search) {
    const matched = await User.find({ name: { $regex: search, $options: 'i' } }).select('_id');
    performedByIds = matched.map((u) => u._id);
    filter.$or = [
      { performedBy: { $in: performedByIds } },
      { targetName: { $regex: search, $options: 'i' } },
    ];
  }

  // Fetch one page of logs + the total count in parallel (newest first).
  const skip = (Number(page) - 1) * Number(limit);
  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('performedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    AuditLog.countDocuments(filter),
  ]);

  res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// ── POST /api/admin/patients/import ──────────────────────────────
// Bulk-create patient accounts from an uploaded CSV file.
// Each row becomes a User (login) + Patient (profile) pair.
const importPatients = asyncHandler(async (req, res) => {
  if (!req.file) throw new ValidationError('No CSV file provided.');

  // Step 1: read the uploaded file as text (strip Excel's hidden BOM char).
  const content = req.file.buffer.toString('utf8').replace(/^﻿/, ''); // strip BOM

  // Step 2: parse CSV → array of row objects keyed by the header line.
  let records;
  try {
    records = parse(content, {
      columns:             true,   // first row = column names
      skip_empty_lines:    true,
      trim:                true,
      relax_column_count:  true,   // tolerate rows with missing trailing cells
    });
  } catch (err) {
    throw new ValidationError(`CSV parse error: ${err.message}`);
  }

  if (records.length === 0) throw new ValidationError('CSV file is empty or has no data rows.');
  if (records.length > 500)  throw new ValidationError('Maximum 500 rows per import.');

  // Step 3: every patient must belong to a clinic — imported patients
  // default to the first active clinic (General OPD when present).
  const defaultClinic =
    (await Clinic.findOne({ isActive: true, clinicName: /opd/i })) ||
    (await Clinic.findOne({ isActive: true }));
  if (!defaultClinic) throw new ValidationError('No active clinic found to register imported patients into.');

  // Step 4: process row by row, collecting a summary as we go.
  const results = { created: 0, skipped: 0, errors: [] };

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2; // header is row 1, so data starts at row 2

    // Accept both lowercase and Capitalised column headings.
    const name  = row.name  || row.Name;
    const email = row.email || row.Email;
    const phone = row.phone || row.Phone;
    const NIC   = row.NIC   || row.nic;

    if (!name || !email || !phone || !NIC) {
      results.errors.push({ row: rowNum, error: 'Missing required field: name, email, phone, or NIC' });
      continue;
    }

    try {
      // Already registered (same email or NIC)? Skip, don't overwrite.
      const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { NIC }] });
      if (existing) {
        results.skipped++;
        continue;
      }

      // No password column → give a predictable default the staff can share.
      const password  = row.password || row.Password || `MediSync@${NIC}`;
      const hash      = await bcrypt.hash(password, 10);

      // Login account…
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        password: hash,
        role:  'patient',
        phone,
        NIC,
      });

      const gender = row.gender || row.Gender || 'not-specified';
      const validGenders = ['male', 'female', 'other', 'not-specified'];

      // …plus the matching patient profile (optional columns fall back to blanks).
      await Patient.create({
        userId:     user._id,
        NIC,
        dateOfBirth: row.dateOfBirth || row.dob || null,
        gender:      validGenders.includes(gender.toLowerCase()) ? gender.toLowerCase() : 'not-specified',
        age:         row.age ? Number(row.age) : undefined,
        address:     row.address || '',
        bloodGroup:  row.bloodGroup || row.blood_group || '',
        emergencyContact: {
          name:         row.emergencyName || '',
          phone:        row.emergencyPhone || '',
          relationship: row.emergencyRelation || '',
        },
        registeredClinics: [defaultClinic._id],
      });

      results.created++;
    } catch (err) {
      results.errors.push({ row: rowNum, error: err.message });
    }
  }

  // Step 5: one audit entry for the whole import + summary back to the UI.
  await logAudit({
    action:      'BULK_IMPORT',
    performedBy: req.user._id,
    targetModel: 'Patient',
    details:     { created: results.created, skipped: results.skipped, errors: results.errors.length, total: records.length },
    req,
  });

  res.json({
    message: `Import complete — ${results.created} created, ${results.skipped} skipped, ${results.errors.length} errors.`,
    ...results,
  });
});

// ── GET /api/admin/roles ──────────────────────────────────────────
// UC20: Roles & Permissions matrix. Missing roles are seeded from the
// defaults so the matrix always reflects what is actually enforced.
const getRolePermissions = asyncHandler(async (req, res) => {
  const roles = ['patient', 'doctor', 'staff', 'admin'];
  const existing = await RolePermission.find({});
  const byRole = Object.fromEntries(existing.map((doc) => [doc.role, doc]));

  // Build a role → permissions map, creating DB rows for any role
  // that has never been saved before.
  const matrix = {};
  for (const role of roles) {
    if (!byRole[role]) {
      byRole[role] = await RolePermission.create({ role, permissions: DEFAULT_ROLE_PERMISSIONS[role] });
    }
    // Admin is locked to its defaults — never read a stale DB row for it.
    matrix[role] = role === 'admin' ? DEFAULT_ROLE_PERMISSIONS.admin : byRole[role].permissions;
  }

  res.json({
    catalog: PERMISSION_KEYS,
    defaults: DEFAULT_ROLE_PERMISSIONS,
    manageableRoles: MANAGEABLE_ROLES,
    roles: matrix,
  });
});

// ── PUT /api/admin/roles/:role ────────────────────────────────────
// Save the ticked permissions for one role from the matrix page.
const updateRolePermissions = asyncHandler(async (req, res) => {
  const { role } = req.params;
  const { permissions } = req.body;

  // Admin's own permissions can never be edited from the UI.
  if (!MANAGEABLE_ROLES.includes(role)) {
    throw new ValidationError('Only patient, doctor, and staff role permissions can be changed');
  }
  if (!Array.isArray(permissions)) throw new ValidationError('permissions must be an array');

  // Reject any permission key we don't recognise.
  const invalid = permissions.filter((key) => !PERMISSION_KEYS.includes(key));
  if (invalid.length) throw new ValidationError(`Unknown permissions: ${invalid.join(', ')}`);

  // Deny-only overlay: a role can never be granted beyond its defaults.
  const beyondDefaults = permissions.filter((key) => !DEFAULT_ROLE_PERMISSIONS[role].includes(key));
  if (beyondDefaults.length) {
    throw new ValidationError(`These permissions are not available for the ${role} role: ${beyondDefaults.join(', ')}`);
  }

  // Save (create the row if it doesn't exist yet) and clear the
  // in-memory cache so the new permissions apply immediately.
  const before = await RolePermission.findOne({ role });
  const doc = await RolePermission.findOneAndUpdate(
    { role },
    { permissions },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  invalidatePermissionCache();

  res.json({ message: 'Role permissions updated successfully', role: doc.role, permissions: doc.permissions });

  logAudit({
    action:      'ROLE_PERMISSIONS_UPDATE',
    performedBy: req.user._id,
    targetModel: 'RolePermission',
    targetId:    doc._id,
    targetName:  role,
    details:     { before: before?.permissions || DEFAULT_ROLE_PERMISSIONS[role], after: permissions },
    req,
  });
});

// ── GET /api/admin/records ────────────────────────────────────────
// UC19: admin oversight of all medical records (search by patient name/NIC).
const getAllRecords = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;

  // Search goes name/NIC → matching Users → their Patient profiles,
  // then filters records to just those patients.
  const filter = {};
  if (search) {
    const users = await User.find({
      role: 'patient',
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { NIC:  { $regex: search, $options: 'i' } },
      ],
    }).select('_id');
    const patients = await Patient.find({ userId: { $in: users.map((u) => u._id) } }).select('_id');
    filter.patientId = { $in: patients.map((p) => p._id) };
  }

  // One page of records (latest visit first) + total count in parallel.
  // populate() swaps the stored IDs for readable patient/doctor/clinic info.
  const skip = (Number(page) - 1) * Number(limit);
  const [records, total] = await Promise.all([
    MedicalRecord.find(filter)
      .populate({ path: 'patientId', populate: { path: 'userId', select: 'name email NIC' } })
      .populate({ path: 'doctorId',  populate: { path: 'userId', select: 'name email' } })
      .populate('clinicId', 'clinicName departmentType')
      .sort({ visitDate: -1 })
      .skip(skip)
      .limit(Number(limit)),
    MedicalRecord.countDocuments(filter),
  ]);

  res.json({ records, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// ── PUT /api/admin/records/:id ────────────────────────────────────
const updateMedicalRecord = asyncHandler(async (req, res) => {
  const record = await MedicalRecord.findById(req.params.id);
  if (!record) throw new NotFoundError('Medical record');

  // Only these medical fields may be edited — patient/doctor/clinic
  // links stay locked. Copy across just the fields that were sent.
  const allowed = ['symptoms', 'diagnosis', 'prescription', 'treatmentNotes',
                   'notes', 'followUpInstructions', 'followUpDate', 'doctorComments', 'tags'];
  const before = {};
  const after  = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) {
      before[field] = record[field];
      after[field]  = req.body[field];
      record[field] = req.body[field];
    }
  });
  await record.save();

  const patient = await Patient.findById(record.patientId).populate('userId', 'name');
  res.json({ message: 'Medical record updated successfully', record });

  logAudit({
    action:      'RECORD_UPDATE',
    performedBy: req.user._id,
    targetModel: 'MedicalRecord',
    targetId:    record._id,
    targetName:  patient?.userId?.name,
    details:     { fields: Object.keys(after) },
    req,
  });
});

// ── DELETE /api/admin/records/:id ─────────────────────────────────
const deleteMedicalRecord = asyncHandler(async (req, res) => {
  const record = await MedicalRecord.findById(req.params.id);
  if (!record) throw new NotFoundError('Medical record');

  // Fetch the patient's name for the audit log before the record goes.
  const patient = await Patient.findById(record.patientId).populate('userId', 'name');
  await record.deleteOne();
  res.json({ message: 'Medical record deleted successfully' });

  logAudit({
    action:      'RECORD_DELETE',
    performedBy: req.user._id,
    targetModel: 'MedicalRecord',
    targetId:    req.params.id,
    targetName:  patient?.userId?.name,
    details:     { diagnosis: record.diagnosis, visitDate: record.visitDate },
    req,
  });
});

module.exports = {
  getUsers, updateUser, deleteUser, dashboardStats,
  listClinics, createClinic, updateClinic, deleteClinic,
  assignStaffClinics,
  getAuditLogs,
  importPatients,
  getRolePermissions, updateRolePermissions,
  getAllRecords, updateMedicalRecord, deleteMedicalRecord,
};
