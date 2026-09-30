import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import app from '../../src/api/app.js';
import { connectDB } from '../../src/config/db.js';
import { User } from '../../src/modules/auth/user.model.js';
import { Product } from '../../src/modules/products/product.model.js';
import { BuyerRequest } from '../../src/modules/requests/request.model.js';
import { callTool } from '../../src/modules/uzhavan/uzhavan.tools.js';
import { ROLES, UNITS } from '@uzhavan360/shared';

describe('Level 8: Final Production Readiness & Security Audit', () => {
  let farmerTokenA, farmerTokenB, buyerTokenA, buyerTokenB;
  let farmerIdA, farmerIdB, buyerIdA, buyerIdB;
  let productAId;
  let requestIdA;

  beforeAll(async () => {
    await connectDB();

    // Clean test accounts
    await User.deleteMany({
      phone: { $in: ['9888000001', '9888000002', '9888000003', '9888000004'] }
    });

    // 1. Farmer A
    const faRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Farmer Audit A',
        phone: '9888000001',
        password: 'correct_password123',
        role: ROLES.FARMER
      });
    farmerTokenA = faRes.body.data.token;
    farmerIdA = faRes.body.data.user._id || faRes.body.data.user.id;

    // 2. Farmer B
    const fbRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Farmer Audit B',
        phone: '9888000002',
        password: 'correct_password123',
        role: ROLES.FARMER
      });
    farmerTokenB = fbRes.body.data.token;
    farmerIdB = fbRes.body.data.user._id || fbRes.body.data.user.id;

    // 3. Buyer A
    const baRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Buyer Audit A',
        phone: '9888000003',
        password: 'correct_password123',
        role: ROLES.BUYER
      });
    buyerTokenA = baRes.body.data.token;
    buyerIdA = baRes.body.data.user._id || baRes.body.data.user.id;

    // 4. Buyer B
    const bbRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Buyer Audit B',
        phone: '9888000004',
        password: 'correct_password123',
        role: ROLES.BUYER
      });
    buyerTokenB = bbRes.body.data.token;
    buyerIdB = bbRes.body.data.user._id || bbRes.body.data.user.id;

    // Create a product owned by Farmer A
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${farmerTokenA}`)
      .send({
        name: 'Organic Cavendish Bananas',
        category: 'FRUITING',
        unit: UNITS.KG,
        pricePerUnit: 40,
        quantity: 200,
        harvestDate: new Date().toISOString(),
        latitude: 11.0168,
        longitude: 76.9558
      });
    productAId = prodRes.body.data?.product?._id || prodRes.body.data?.product?.id;

    // Create a request owned by Buyer A
    const reqRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${buyerTokenA}`)
      .send({
        productId: productAId,
        requestedQuantity: 25,
        targetPricePerUnit: 40,
        deliveryPreference: 'FARM_GATE_PICKUP'
      });
    requestIdA = reqRes.body.data?.request?._id || reqRes.body.data?.request?.id;
  });

  // ── Health Check Validation ────────────────────────────────────────────────
  it('GET /health returns 200 with dynamic connected database status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('HEALTHY');
    expect(res.body.data.integrations.database.status).toBe('connected');
  });

  it('GET /api/health returns 200 with valid integration metadata', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.service).toBe('Uzhavan 360 API');
    expect(res.body.data.integrations.mapProvider.status).toBe('ready');
  });

  // ── Authentication Audit ──────────────────────────────────────────────────
  it('Auth Audit - Login fails with 401 when given an incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        phone: '9888000001',
        password: 'WRONG_PASSWORD_XYZ'
      });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('Auth Audit - Protected route returns 401 when given a malformed or invalid JWT', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.bogus.token');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/token/i);
  });

  it('Auth Audit - Protected route returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // ── Authorization & RBAC Audit ────────────────────────────────────────────
  it('RBAC Audit - Buyer cannot access farmer product listing endpoint (403)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${buyerTokenA}`)
      .send({
        name: 'Illegal Listing',
        category: 'FRUITING',
        unit: UNITS.KG,
        pricePerUnit: 10,
        totalStock: 50,
        availableStock: 50,
        harvestDate: new Date().toISOString(),
        locationLat: 11.0,
        locationLng: 77.0
      });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Access denied/i);
  });

  it('RBAC Audit - Non-admin user cannot access admin metrics API (403)', async () => {
    const res = await request(app)
      .get('/api/admin/metrics')
      .set('Authorization', `Bearer ${farmerTokenA}`);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // ── Tenant & Ownership Isolation Audit ─────────────────────────────────────
  it('Ownership Audit - Farmer B cannot edit or modify Farmer A product (403)', async () => {
    const res = await request(app)
      .patch(`/api/products/${productAId}`)
      .set('Authorization', `Bearer ${farmerTokenB}`)
      .send({
        pricePerUnit: 999
      });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Unauthorized: You can only edit your own products/i);
  });

  it('Ownership Audit - Buyer B cannot cancel Buyer A request (403)', async () => {
    const res = await request(app)
      .patch(`/api/requests/${requestIdA}/cancel`)
      .set('Authorization', `Bearer ${buyerTokenB}`)
      .send({
        cancellationReason: 'Malicious cancellation by competitor'
      });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Unauthorized: You can only cancel your own requests/i);
  });

  // ── Input Sanitization & Error Handling Audit ──────────────────────────────
  it('Input Security - Product creation fails safely (400) when given negative price or stock', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${farmerTokenA}`)
      .send({
        name: 'Negative Stock Crop',
        category: 'FRUITING',
        unit: UNITS.KG,
        pricePerUnit: -10,
        quantity: -100,
        harvestDate: new Date().toISOString(),
        latitude: 11.0,
        longitude: 77.0
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('Input Security - Marketplace search safely handles regex injection characters without failing', async () => {
    const res = await request(app)
      .get('/api/marketplace')
      .query({ search: '.*+?^${}()|[]\\' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  // ── AI Tool Security & Prompt Injection Defense ────────────────────────────
  it('AI Security - Farmer-only tool is rejected by gateway when invoked with Buyer context', async () => {
    await expect(
      callTool('createProduct', { id: buyerIdA, role: ROLES.BUYER }, {
        name: 'Injected Tool Call',
        category: 'FRUITING',
        unit: UNITS.KG,
        pricePerUnit: 20,
        totalStock: 50,
        availableStock: 50,
        harvestDate: new Date().toISOString(),
        locationLat: 11.0,
        locationLng: 77.0
      })
    ).rejects.toThrow(/not available for your role/i);
  });
});
