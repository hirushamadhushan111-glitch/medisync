/**
 * OOP Concept: Decorator Pattern + Higher-Order Function
 *
 * asyncHandler wraps any async controller method so that
 * errors are automatically forwarded to Express error middleware.
 * Eliminates repetitive try/catch in every controller.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 */

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
