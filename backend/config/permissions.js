/**
 * Role & Permission catalog (UC20 — Manage Roles & Permissions).
 *
 * Each permission maps to real API routes via matchers. The defaults below
 * mirror the static authorizeRoles() guards exactly, so with an untouched
 * database the system behaves the same as before.
 *
 * Enforcement is DENY-ONLY: an admin can revoke a default permission from a
 * role, but can never grant access beyond what the static route guards allow.
 * The admin role always bypasses dynamic checks (no lock-out possible).
 */

const PERMISSION_CATALOG = [
  { key: 'register_users',         matchers: [{ method: 'POST',   pattern: /^\/api\/auth\/create-user\/?$/ }] },
  { key: 'book_appointments',      matchers: [{ method: 'POST',   pattern: /^\/api\/appointments\/?$/ }] },
  { key: 'view_all_appointments',  matchers: [{ method: 'GET',    pattern: /^\/api\/appointments\/?$/ }] },
  { key: 'manage_appointments',    matchers: [{ method: 'PUT',    pattern: /^\/api\/appointments\/[^/]+\/?$/ }] },
  { key: 'cancel_appointments',    matchers: [{ method: 'DELETE', pattern: /^\/api\/appointments\/[^/]+\/?$/ }] },
  { key: 'generate_queue_tokens',  matchers: [{ method: 'POST',   pattern: /^\/api\/queue\/generate\/?$/ }] },
  {
    key: 'manage_queue',
    matchers: [
      { method: 'PUT', pattern: /^\/api\/queue\/next\/[^/]+\/?$/ },
      { method: 'PUT', pattern: /^\/api\/queue\/status\/[^/]+\/?$/ },
    ],
  },
  { key: 'add_medical_records',    matchers: [{ method: 'POST',   pattern: /^\/api\/records\/?$/ }] },
  { key: 'update_medical_records', matchers: [{ method: 'PUT',    pattern: /^\/api\/records\/[^/]+\/?$/ }] },
  { key: 'view_medical_records',   matchers: [{ method: 'GET',    pattern: /^\/api\/records(\/|$)/ }] },
  { key: 'search_patients',        matchers: [{ method: 'GET',    pattern: /^\/api\/patients\/search\/?$/ }] },
  { key: 'view_reports',           matchers: [{ method: 'GET',    pattern: /^\/api\/reports(\/|$)/ }] },
  { key: 'manage_users',           matchers: [{ method: '*',      pattern: /^\/api\/admin\/users(\/|$)/ }] },
  {
    // Write operations only — GET /api/admin/clinics is the shared clinic
    // list used by every role's pages, so it must stay unmatched.
    key: 'manage_clinics',
    matchers: [
      { method: 'POST',   pattern: /^\/api\/admin\/clinics\/?$/ },
      { method: 'PUT',    pattern: /^\/api\/admin\/clinics\/[^/]+\/?$/ },
      { method: 'DELETE', pattern: /^\/api\/admin\/clinics\/[^/]+\/?$/ },
    ],
  },
  { key: 'view_audit_logs',        matchers: [{ method: 'GET',    pattern: /^\/api\/admin\/audit-logs\/?$/ }] },
  { key: 'manage_roles',           matchers: [{ method: '*',      pattern: /^\/api\/admin\/roles(\/|$)/ }] },
];

const PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

const DEFAULT_ROLE_PERMISSIONS = {
  patient: ['book_appointments', 'cancel_appointments', 'view_medical_records'],
  // The doctor drives their own queue (Call Next / skip); reception only views it.
  doctor: [
    'add_medical_records', 'update_medical_records', 'view_medical_records',
    'search_patients', 'manage_queue',
  ],
  staff: [
    'register_users', 'book_appointments', 'view_all_appointments',
    'manage_appointments', 'cancel_appointments', 'generate_queue_tokens',
    'view_medical_records', 'search_patients',
  ],
  // Per the design report, booking (UC2/FR-02) and queue handling (UC10/UC11)
  // belong to patients and reception staff — not the admin role.
  admin: PERMISSION_KEYS.filter(
    (key) => !['book_appointments', 'generate_queue_tokens', 'manage_queue'].includes(key)
  ),
};

const MANAGEABLE_ROLES = ['patient', 'doctor', 'staff'];

// ── Cached role → permissions lookup (deny-only overlay) ─────────────
const CACHE_TTL_MS = 30 * 1000;
let cache = null;
let cacheLoadedAt = 0;

// Clear the cache — called right after the admin edits role permissions.
const invalidatePermissionCache = () => { cache = null; cacheLoadedAt = 0; };

// role → allowed permission keys, from the DB with a 30s in-memory cache.
const loadRolePermissions = async () => {
  if (cache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return cache;

  const RolePermission = require('../models/RolePermission');
  const docs = await RolePermission.find({});
  const map = { ...DEFAULT_ROLE_PERMISSIONS };
  docs.forEach((doc) => { map[doc.role] = doc.permissions; });

  cache = map;
  cacheLoadedAt = Date.now();
  return map;
};

// Which permission keys govern this method + path (via the catalog matchers).
const matchedPermissionKeys = (method, path) =>
  PERMISSION_CATALOG
    .filter((perm) => perm.matchers.some(
      (m) => (m.method === '*' || m.method === method) && m.pattern.test(path)
    ))
    .map((perm) => perm.key);

/**
 * Returns true when the role is still allowed to perform method+path.
 * Fails open: unknown routes or lookup errors never block a request —
 * the static authorizeRoles() list remains the baseline guard.
 */
const isAllowedByRolePermissions = async (role, method, path) => {
  if (role === 'admin') return true;

  const matched = matchedPermissionKeys(method, path);
  if (matched.length === 0) return true;

  try {
    const map = await loadRolePermissions();
    const granted = map[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
    return matched.some((key) => granted.includes(key));
  } catch (err) {
    console.error('[Permissions] lookup failed, allowing request:', err.message);
    return true;
  }
};

module.exports = {
  PERMISSION_CATALOG,
  PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  MANAGEABLE_ROLES,
  isAllowedByRolePermissions,
  invalidatePermissionCache,
};
