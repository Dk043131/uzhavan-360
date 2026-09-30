/**
 * Uzhavan 360 - Shared Roles
 * Level 1 Architecture Reference: Section 6 & 32
 */

export const ROLES = Object.freeze({
  FARMER: 'ROLE_FARMER',
  BUYER: 'ROLE_BUYER',
  ADMIN: 'ROLE_ADMIN'
});

export const ALL_ROLES = Object.freeze(Object.values(ROLES));
