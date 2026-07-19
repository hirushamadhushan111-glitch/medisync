/**
 * validateRequest.js — collects express-validator results.
 *
 * Place this AFTER a route's validation rules; if any rule failed it
 * replies 400 with a list of { field, message, value } items, otherwise
 * the request continues to the controller.
 */
const { validationResult } = require('express-validator');

// Reply 400 with field errors when any validation rule failed.
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(({ path, msg, value }) => ({ field: path, message: msg, value })),
    });
  }

  return next();
};

module.exports = validateRequest;
