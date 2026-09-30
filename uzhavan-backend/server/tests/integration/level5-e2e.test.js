import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../src/api/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { User } from '../../src/modules/auth/user.model.js';
import { Product } from '../../src/modules/products/product.model.js';
import { BuyerRequest } from '../../src/modules/requests/request.model.js';
import { Order } from '../../src/modules/orders/order.model.js';
import { ROLES, UNITS } from '@uzhavan360/shared';

describe('Level 5: Complete Frontend-Backend End-to-End Integration Flow', () => {
  let farmerToken;
  let buyerToken;
  let farmerId;
  let buyerId;
  let productId;
  let requestId;
  let orderId;

  beforeAll(async () => {
    await connectDB();

    // Clean test accounts
    await User.deleteMany({ phone: { $in: ['9888000001', '9888000002'] } });

    // 1. Farmer Registration & Login
    const fRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'L5 Farmer Murugan',
        phone: '9888000001',
        password: 'password123',
        role: ROLES.FARMER,
        farmDetails: {
          farmName: 'Murugan Estate',
          address: { village: 'Sulur', district: 'Coimbatore' },
          location: { type: 'Point', coordinates: [76.9558, 11.0168] }
        }
      });
    farmerToken = fRes.body.data.token;
    farmerId = fRes.body.data.user._id || fRes.body.data.user.id;

    // 2. Buyer Registration & Login
    const bRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'L5 Buyer Revathi',
        phone: '9888000002',
        password: 'password123',
        role: ROLES.BUYER,
        buyerDetails: {
          businessType: 'RETAIL'
        }
      });
    buyerToken = bRes.body.data.token;
    buyerId = bRes.body.data.user._id || bRes.body.data.user.id;
  });

  afterAll(async () => {
    if (productId) {
      await Product.deleteOne({ _id: productId });
      await BuyerRequest.deleteMany({ productId });
      await Order.deleteMany({ productId });
    }
    await User.deleteMany({ phone: { $in: ['9888000001', '9888000002'] } });
    await disconnectDB();
  });

  // ── Step 1: Farmer Creates Product ──────────────────────────────────────
  it('Step 1: Farmer creates produce listing with 500kg initial stock', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        name: 'L5 Organic Brinjal (கத்தரிக்காய்)',
        category: 'FRUITING',
        unit: UNITS.KG,
        pricePerUnit: 35,
        quantity: 500,
        harvestDate: new Date(),
        latitude: 11.0168,
        longitude: 76.9558,
        description: 'Naturally grown country brinjal'
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    const prod = res.body.data.product;
    productId = prod._id;
    expect(prod.availableStock).toBe(500);
    expect(prod.totalStock).toBe(500);
  });

  // ── Step 2: Farmer Adds 200kg Additional Harvest ────────────────────────
  it('Step 2: Farmer adds 200kg harvest batch to the produce inventory', async () => {
    const res = await request(app)
      .post('/api/inventory/add-harvest')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        productId,
        quantity: 200,
        reason: 'Mid-week second harvest'
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    // 500 + 200 = 700kg
    expect(res.body.data.product.availableStock).toBe(700);
    expect(res.body.data.product.totalStock).toBe(700);
  });

  // ── Step 3: Buyer Browses Marketplace & Finds Produce ───────────────────
  it('Step 3: Buyer browses marketplace and retrieves the produce item', async () => {
    const res = await request(app)
      .get('/api/marketplace?lat=11.0168&lng=76.9558&radius=30')
      .expect(200);

    expect(res.body.success).toBe(true);
    const item = res.body.data.items.find((p) => p._id === productId);
    expect(item).toBeDefined();
    expect(item.availableStock).toBe(700);
    expect(item.fuzzedLocation).toBeDefined(); // ~800m privacy jitter verified
  });

  // ── Step 4: Buyer Submits Purchase Request (Phase 1: Inquire) ────────────────────
  it('Step 4: Buyer submits purchase request (Phase 1: Inquire)', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        productId,
        note: 'Need 100kg for retail distribution'
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    const reqItem = res.body.data.request;
    expect(reqItem.status).toBe('REQUESTED');
    requestId = reqItem._id;

    // Stock MUST NOT be reserved during inquiry phase!
    const productCheck = await Product.findById(productId);
    expect(productCheck.availableStock).toBe(700);
    expect(productCheck.reservedStock).toBe(0);
  });

  // ── Step 5: Farmer Reviews & Accepts Request ────────────────────────────
  it('Step 5: Farmer reviews requests inbox and accepts buyer inquiry', async () => {
    const res = await request(app)
      .patch(`/api/requests/${requestId}/accept`)
      .set('Authorization', `Bearer ${farmerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.request.status).toBe('ACCEPTED');
  });

  // ── Step 6: Buyer Confirms Quantity (Phase 2 -> Stock Reserved) ─────────
  it('Step 6: Buyer confirms 100kg quantity and locks atomic 12-hour reservation', async () => {
    const res = await request(app)
      .post(`/api/orders/confirm-quantity/${requestId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        quantity: 100,
        idempotencyKey: `idem-l5-${Date.now()}`
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    const ord = res.body.data.order;
    expect(ord.status).toBe('RESERVED');
    expect(ord.reservedQuantity).toBe(100);
    orderId = ord.id || ord._id;

    // Inventory check: available decreased by 100, reserved increased by 100
    const productCheck = await Product.findById(productId);
    expect(productCheck.availableStock).toBe(600);
    expect(productCheck.reservedStock).toBe(100);
    expect(productCheck.soldStock).toBe(0);
    expect(productCheck.totalStock).toBe(700);
  });

  // ── Step 7: Farmer Progresses Order State to READY_FOR_PICKUP ───────────
  it('Step 7: Farmer marks order as PREPARING then READY_FOR_PICKUP', async () => {
    // 1. Preparing
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({ status: 'PREPARING' })
      .expect(200);

    // 2. Ready for Pickup
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({ status: 'READY_FOR_PICKUP' })
      .expect(200);

    expect(res.body.data.order.status).toBe('READY_FOR_PICKUP');
  });

  // ── Step 8: Farmer Completes Order (Settlement & Ledger Update) ─────────
  it('Step 8: Farmer completes order on farmgate pickup and finalizes sale in ledger', async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/complete`)
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({ fulfilledQuantity: 100 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.order.status).toBe('COMPLETED');

    // Invariant check: reserved decreases to 0, sold increases to 100
    const productCheck = await Product.findById(productId);
    expect(productCheck.availableStock).toBe(600);
    expect(productCheck.reservedStock).toBe(0);
    expect(productCheck.soldStock).toBe(100);
    expect(productCheck.totalStock).toBe(700);
  });

  // ── Step 9: Farmer Records External Cash Sale ────────────────────────────
  it('Step 9: Farmer records 50kg off-platform sale (farmgate cash sale)', async () => {
    const res = await request(app)
      .post('/api/inventory/off-platform-sale')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        productId,
        quantity: 50,
        reason: 'Local village sandhai cash customer'
      })
      .expect(200);

    expect(res.body.success).toBe(true);

    // Invariant check: available decreases to 550, sold increases to 150
    const productCheck = await Product.findById(productId);
    expect(productCheck.availableStock).toBe(550);
    expect(productCheck.reservedStock).toBe(0);
    expect(productCheck.soldStock).toBe(150);
    expect(productCheck.totalStock).toBe(700);
    // Double-entry invariant strictly holds
    expect(productCheck.availableStock + productCheck.reservedStock + productCheck.soldStock).toBe(
      productCheck.totalStock
    );
  });
});
