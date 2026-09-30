/**
 * Centralized Error Handling
 * Level 1 Architecture Reference: Section 29 & Level 2 Error Model
 */

/**
 * AppError — Operational errors with known HTTP status codes.
 * These are expected business/validation errors, not programmer bugs.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global Express error handler.
 * Must be registered AFTER all routes in app.js.
 */
export function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred.';
  let details = err.details || null;

  // Mongoose duplicate key error (e.g. unique phone)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field
      ? `A record with this ${field} already exists.`
      : 'Duplicate record detected.';
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed.';
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message
    }));
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ID format for field "${err.path}".`;
  }

  // JWT errors (also handled in auth middleware — belt-and-suspenders)
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired. Please log in again.';
  }

  // Never leak stack traces in production
  const isDev = process.env.NODE_ENV === 'development';

  console.error(`[ERROR] ${statusCode} ${req.method} ${req.path} — ${message}`);
  if (isDev && err.stack) {
    console.error(err.stack);
  }

  return res.status(statusCode).json({
    success: false,
    service: 'Uzhavan 360 API',
    error: message,
    details,
    ...(isDev && !err.isOperational && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
}

/**
 * 404 Not Found handler.
 */
export function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    service: 'Uzhavan 360 API',
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
}
