/**
 * RolePermission model — the admin-managed permission overlay.
 *
 * One document per role. `permissions` holds the keys that are currently
 * ALLOWED for that role; a key removed by the admin is denied at runtime
 * by authMiddleware (deny-only enforcement — see config/permissions.js).
 */
const mongoose = require('mongoose');
const { PERMISSION_KEYS } = require('../config/permissions');

const rolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      unique: true,
      enum: ['patient', 'doctor', 'staff', 'admin'],
    },
    permissions: {
      type: [{ type: String, enum: PERMISSION_KEYS }],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RolePermission', rolePermissionSchema);
