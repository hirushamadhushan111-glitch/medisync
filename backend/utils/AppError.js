/**
 * OOP Concept: Inheritance + Encapsulation
 *
 * AppError is the base class. All custom errors inherit from it.
 * Each subclass encapsulates a specific error type with its own
 * default status code and message.
 *
 * Hierarchy:
 *   Error (built-in)
 *     └── AppError          (base custom error)
 *           ├── ValidationError   (400)
 *           ├── AuthError         (401)
 *           ├── ForbiddenError    (403)
 *           ├── NotFoundError     (404)
 *           └── ConflictError     (409)
 */

class AppError extends Error {
  // Every custom error carries a message + HTTP status code.
  constructor(message, statusCode = 500) {
    super(message);           // call parent constructor (Inheritance)
    this.statusCode = statusCode;
    this.isOperational = true; // marks expected, handleable errors
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── Subclasses (Inheritance + Polymorphism) ───────────────────

class ValidationError extends AppError {
  // 400 Bad Request — the input broke a validation rule.
  constructor(message = 'Validation failed') {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

class AuthError extends AppError {
  // 401 Unauthorized — not logged in / bad credentials.
  constructor(message = 'Authentication required') {
    super(message, 401);
    this.name = 'AuthError';
  }
}

class ForbiddenError extends AppError {
  // 403 Forbidden — logged in, but this role may not do this.
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends AppError {
  // 404 Not Found — pass the resource name, e.g. new NotFoundError('Doctor').
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  // 409 Conflict — duplicate data (e.g. email/NIC already registered).
  constructor(message = 'Resource already exists') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};
