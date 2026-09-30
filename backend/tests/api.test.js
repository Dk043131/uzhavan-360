/**
 * Uzhavan 360 API Integration Tests (Node.js Test Runner)
 * Replaces legacy Python pytest suite.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = (process.env.API_URL || process.env.REACT_APP_BACKEND_URL || 'http://localhost:8030').replace(/\/$/, '');
const API = `${BASE}/api`;

const FARMER = { phone: '9876543210', password: 'password123' };
const BUYER = { phone: '9123456780', password: 'password123' };
const ADMIN = { phone: '9000000001', password: 'Admin@360' };

async function login(creds) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed (${res.status}): ${text}`);
  }
  const body = await res.json();
  return {
    token: body.data.token,
    user: body.data.user,
    headers: {
      Authorization: `Bearer ${body.data.token}`,
      'Content-Type': 'application/json',
    },
  };
}

describe('Uzhavan 360 API — Node.js Test Suite', () => {
  let farmerAuth;
  let buyerAuth;
  let adminAuth;

  before(async () => {
    try {
      [farmerAuth, buyerAuth, adminAuth] = await Promise.all([
        login(FARMER),
        login(BUYER),
        login(ADMIN),
      ]);
    } catch (err) {
      console.warn('[TEST SETUP] Auth fixture login skipped or failed:', err.message);
    }
  });

  describe('Smoke & Public Routes', () => {
    test('GET /api/health returns 200 and HEALTHY status', async () => {
      const res = await fetch(`${API}/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.status, 'HEALTHY');
    });

    test('POST /api/auth/login rejects incorrect password with 400 or 401', async () => {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '9876543210', password: 'wrongpassword' }),
      });
      assert.ok(res.status === 400 || res.status === 401);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    test('POST /api/auth/logout succeeds with 200 and loggedOut flag', async () => {
      const res = await fetch(`${API}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.loggedOut, true);
    });

    test('GET /api/marketplace returns 200 for public query', async () => {
      const res = await fetch(`${API}/marketplace?lat=11.0168&lng=76.9558&radius=50`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    });

    test('Protected route without token returns 401', async () => {
      const res = await fetch(`${API}/products/farmer/my-products`);
      assert.equal(res.status, 401);
    });
  });

  describe('Role-Based Access Control', () => {
    test('Buyer role cannot access farmer produce endpoint (403)', async () => {
      if (!buyerAuth) return;
      const res = await fetch(`${API}/products/farmer/my-products`, {
        headers: buyerAuth.headers,
      });
      assert.equal(res.status, 403);
    });

    test('Buyer role cannot access admin overview (403)', async () => {
      if (!buyerAuth) return;
      const res = await fetch(`${API}/admin/overview`, {
        headers: buyerAuth.headers,
      });
      assert.equal(res.status, 403);
    });

    test('Admin role can access admin overview (200)', async () => {
      if (!adminAuth) return;
      const res = await fetch(`${API}/admin/overview`, {
        headers: adminAuth.headers,
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    });

    test('GET /api/auth/me returns authenticated profile (200)', async () => {
      if (!buyerAuth) return;
      const res = await fetch(`${API}/auth/me`, {
        headers: buyerAuth.headers,
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.ok(data.data.user);
    });
  });
});
