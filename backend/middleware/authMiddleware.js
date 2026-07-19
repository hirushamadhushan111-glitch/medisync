/**
 * authMiddleware.js — protects API routes.
 *
 *  - verifyToken:          checks the "Bearer <JWT>" header and attaches
 *                          the logged-in user to req.user.
 *  - authorizeRoles(...r): allows only the given roles through, then applies
 *                          the admin-managed role-permission overlay.
 *  - allowAccountCreation: only staff/admin may create new accounts.
 *
 * Usage in routes:  router.post('/x', verifyToken, authorizeRoles('admin'), handler)
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isAllowedByRolePermissions } = require('../config/permissions');

// Decode the JWT, load the user, and reject inactive/deleted accounts.
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication token is required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User is inactive or no longer exists' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired authentication token' });
  }
};

// Role gate factory: only the listed roles pass, then the admin overlay is checked.
const authorizeRoles = (...roles) => async (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission to access this resource' });
  }

  // Dynamic role-permission overlay (admin-managed, deny-only).
  const path = (req.originalUrl || req.url).split('?')[0];
  const allowed = await isAllowedByRolePermissions(req.user.role, req.method, path);
  if (!allowed) {
    return res.status(403).json({ message: 'This permission has been disabled for your role by the administrator' });
  }

  next();
};

// Only staff/admin can create accounts (plus the admin overlay check).
const allowAccountCreation = async (req, res, next) => {
  if (!req.user || !['staff', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only staff or admin users can create accounts' });
  }

  // Request path without the query string.
  const path = (req.originalUrl || req.url).split('?')[0];
  const allowed = await isAllowedByRolePermissions(req.user.role, req.method, path);
  if (!allowed) {
    return res.status(403).json({ message: 'This permission has been disabled for your role by the administrator' });
  }

  next();
};

module.exports = { verifyToken, authorizeRoles, allowAccountCreation };
