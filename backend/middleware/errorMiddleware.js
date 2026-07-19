/**
 * OOP Concept: Polymorphism via error type dispatch
 *
 * errorHandler identifies the type of each error and responds
 * with the appropriate HTTP status code and message.
 * It handles both our custom AppError subclasses and
 * built-in Mongoose / JWT errors.
 */

const { AppError, NotFoundError } = require('../utils/AppError');

// ── 404 handler for unknown routes ───────────────────────────────
const notFound = (req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl}`));
};

// ── Map Mongoose / JWT errors to AppError instances ─────────────
const normalizeError = (err) => {
  // Already a handled operational error — pass through untouched
  if (err.isOperational) return err;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message).join(', ');
    return new AppError(messages, 400);
  }

  // Mongoose duplicate key (e.g. unique email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return new AppError(`Duplicate value for ${field}. Please use another value.`, 409);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return new AppError(`Invalid ID format: ${err.value}`, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError')  return new AppError('Invalid token. Please log in again.', 401);
  if (err.name === 'TokenExpiredError')  return new AppError('Token expired. Please log in again.', 401);

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE')    return new AppError('File too large. Maximum size is 10 MB.', 400);
  if (err.code === 'LIMIT_UNEXPECTED_FILE') return new AppError('Unexpected file field.', 400);

  return err; // already an AppError or unknown — pass through
};

// ── Global error handler ─────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  const error      = normalizeError(err);
  const statusCode = error.statusCode || 500;
  const isOp       = error.isOperational || false;
  const isProd     = process.env.NODE_ENV === 'production';

  // Log unexpected (non-operational) errors
  if (!isOp) {
    console.error('UNEXPECTED ERROR:', err);
  }

  res.status(statusCode).json({
    status:  statusCode < 500 ? 'fail' : 'error',
    message: error.message || 'Something went wrong. Please try again.',
    ...(isProd ? {} : { stack: error.stack }),
  });
};

module.exports = { notFound, errorHandler };
