/**
 * Standard API Response Helpers
 * Level 1 Architecture Reference: Section 29 — API Response Design
 */

export function sendSuccess(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    service: 'Uzhavan 360 API',
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

export function sendError(res, message = 'An error occurred', statusCode = 400, details = null) {
  return res.status(statusCode).json({
    success: false,
    service: 'Uzhavan 360 API',
    error: message,
    details,
    timestamp: new Date().toISOString()
  });
}
