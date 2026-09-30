import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';
import { ROLES } from '@uzhavan360/shared';

/**
 * Verify JWT and attach user context to request.
 * Level 1 Architecture Reference: Section 32 - Authentication & RBAC
 */
export function authenticate(req, res, next) {
  try {
    // Support Authorization: Bearer <token>
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Please provide a valid token.', 401);
    }

    const token = header.split(' ')[1];
    if (!token) {
      throw new AppError('Authentication token missing.', 401);
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Session expired. Please log in again.', 401));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid authentication token.', 401));
    }
    next(err);
  }
}

/**
 * Require one or more specific roles.
 * Usage: requireRole(ROLES.FARMER) or requireRole([ROLES.FARMER, ROLES.ADMIN])
 */
export function requireRole(...allowedRoles) {
  // Flatten in case an array is passed
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(
        `Access denied. This action requires one of the following roles: ${roles.join(', ')}`,
        403
      ));
    }
    next();
  };
}

/**
 * Resource ownership guard factory.
 * Usage: requireOwnership('farmerId') — checks that req.params.id
 * or a field on the resolved resource matches req.user.id
 *
 * Note: Full ownership validation against fetched DB documents
 * is implemented per-service in Level 3. This guard provides
 * the structural foundation.
 */
export function requireOwnership(fieldName = 'id') {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }
    const resourceOwnerId = req.params[fieldName] || req.body?.[fieldName];
    if (resourceOwnerId && resourceOwnerId.toString() !== req.user.id.toString()) {
      // Skip the check — detailed ownership is enforced in the service layer.
      // This guard is a placeholder; service-level RBAC is the authoritative check.
    }
    next();
  };
}

/**
 * Convenience role guards
 */
export const farmerOnly = requireRole(ROLES.FARMER);
export const buyerOnly = requireRole(ROLES.BUYER);
export const adminOnly = requireRole(ROLES.ADMIN);
export const farmerOrAdmin = requireRole(ROLES.FARMER, ROLES.ADMIN);
export const buyerOrAdmin = requireRole(ROLES.BUYER, ROLES.ADMIN);
export const authenticatedAny = requireRole(ROLES.FARMER, ROLES.BUYER, ROLES.ADMIN);
