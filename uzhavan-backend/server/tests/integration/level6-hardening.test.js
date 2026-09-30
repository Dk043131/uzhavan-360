import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../src/api/app.js';
import { connectDB } from '../../src/config/db.js';
import { User } from '../../src/modules/auth/user.model.js';
import { Product } from '../../src/modules/products/product.model.js';
import { BuyerRequest } from '../../src/modules/requests/request.model.js';
import { Order } from '../../src/modules/orders/order.model.js';
import { InventoryLedger } from '../../src/modules/inventory/inventoryLedger.model.js';
import { checkAndExpireReservations } from '../../src/modules/orders/orders.service.js';
import { ROLES, ORDER_STATES, REQUEST_STATES, UNITS } from '@uzhavan360/shared';

describe('Level 6: Production Robustness, State Hardening & Expiration Verification', () => {
  let farmerAToken, farmerBToken, buyerAToken, buyerBToken;
  let farmerAId, farmerBId, buyerAId, buyerBId;
  let testProductId;

  beforeAll(async () => {
    await connectDB();

    // Clean any residual test users
    await User.deleteMany({
      phone: { $in: ['9777000001', '9777000002', '9777000003', '9777000004'] }
    });

    // 1. Register Farmer A
    const faRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Farmer Alpha',
        phone: '9777000001',
        password: 'password123',
        role: ROLES.FARMER,
        farmDetails: {
          farmName: 'Alpha Organic Farm',
          address: { village: 'Thondamuthur', district: 'Coimbatore' },
          location: { type: 'Point', coordinates: [76.85, 10.98] }
        }
      });
    farmerAToken = faRes.body.data.token;
    farmerAId = faRes.body.data.user._id || faRes.body.data.user.id;

    // 2. Register Farmer B (Adversary / Competitor)
    const fbRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Farmer Beta',
        phone: '9777000002',
        password: 'password123',
        role: ROLES.FARMER,
        farmDetails: {
          farmName: 'Beta Green Farm',
          address: { village: 'Pollachi', district: 'Coimbatore' },
          location: { type: 'Point', coordinates: [77.01, 10.66] }
        }
      });
    farmerBToken = fbRes.body.data.token;
    farmerBId = fbRes.body.data.user._id || fbRes.body.data.user.id;

    // 3. Register Buyer A
    const baRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Buyer Alpha Retail',
        phone: '9777000003',
        password: 'password123',
        role: ROLES.BUYER,
        buyerDetails: { businessType: 'RETAIL' }
      });
    buyerAToken = baRes.body.data.token;
    buyerAId = baRes.body.data.user._id || baRes.body.data.user.id;

    // 4. Register Buyer B
    const bbRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Buyer Beta Wholesale',
        phone: '9777000004',
        password: 'password123',
        role: ROLES.BUYER,
        buyerDetails: { businessType: 'WHOLESALE' }
      });
    buyerBToken = bbRes.body.data.token;
    buyerBId = bbRes.body.data.user._id || bbRes.body.data.user.id;

    // Create a shared test product for Farmer A: 100 kg Tomatoes
    const pRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${farmerAToken}`)
      .send({
        name: 'Country Tomatoes (Level 6)',
        category: 'FRUITING',
        quantity: 100,
        unit: UNITS.KG,
        pricePerUnit: 35,
        harvestDate: new Date(),
        latitude: 10.98,
        longitude: 76.85
      });
    testProductId = pRes.body.data.product._id;
  });

  beforeEach(async () => {
    await BuyerRequest.deleteMany({ productId: testProductId });
    await Order.deleteMany({ productId: testProductId });
    await Product.findByIdAndUpdate(testProductId, {
      availableStock: 100,
      reservedStock: 0,
      soldStock: 0,
      totalStock: 100
    });
  });

  afterAll(async () => {
    if (testProductId) {
      await Product.findByIdAndDelete(testProductId);
      await BuyerRequest.deleteMany({ productId: testProductId });
      await Order.deleteMany({ productId: testProductId });
      await InventoryLedger.deleteMany({ productId: testProductId });
    }
    await User.deleteMany({
      phone: { $in: ['9777000001', '9777000002', '9777000003', '9777000004'] }
    });
  });

  // ── TEST GROUP 1: State Machine Transition Hardening ─────────────────────
  describe('State Machine & Transition Hardening', () => {
    it('should reject accepting a request that was already rejected', async () => {
      // Buyer A creates request
      const reqRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${buyerAToken}`)
        .send({ productId: testProductId, note: 'Need fresh batch' });
      const reqId = reqRes.body.data.request._id;

      // Farmer A rejects it
      const rejRes = await request(app)
        .patch(`/api/requests/${reqId}/reject`)
        .set('Authorization', `Bearer ${farmerAToken}`)
        .send({ rejectionReason: 'Stock reserved for local market' });
      expect(rejRes.status).toBe(200);

      // Now attempting to accept the already rejected request must fail with 400
      const acceptRes = await request(app)
        .patch(`/api/requests/${reqId}/accept`)
        .set('Authorization', `Bearer ${farmerAToken}`);
      expect(acceptRes.status).toBe(400);
      expect(acceptRes.body.error).toMatch(/Invalid state transition/i);
    });

    it('should reject cancelling an order that has already been completed', async () => {
      // Create and accept request
      const reqRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${buyerAToken}`)
        .send({ productId: testProductId });
      const reqId = reqRes.body.data.request._id;

      await request(app)
        .patch(`/api/requests/${reqId}/accept`)
        .set('Authorization', `Bearer ${farmerAToken}`);

      // Buyer confirms 10kg
      const ordRes = await request(app)
        .post(`/api/orders/confirm-quantity/${reqId}`)
        .set('Authorization', `Bearer ${buyerAToken}`)
        .send({ quantity: 10, idempotencyKey: `idem-l6-${Date.now()}` });
      const orderId = ordRes.body.data.order._id;

      // Farmer completes the order
      const compRes = await request(app)
        .patch(`/api/orders/${orderId}/complete`)
        .set('Authorization', `Bearer ${farmerAToken}`)
        .send({ fulfilledQuantity: 10 });
      expect(compRes.status).toBe(200);

      // Now attempting to cancel by buyer must fail with 400
      const cancelRes = await request(app)
        .patch(`/api/orders/${orderId}/cancel-by-buyer`)
        .set('Authorization', `Bearer ${buyerAToken}`)
        .send({ reason: 'Changed mind' });
      expect(cancelRes.status).toBe(400);
    });
  });

  // ── TEST GROUP 2: Authorization & Ownership Isolation ────────────────────
  describe('Multi-tenant Authorization & Ownership Isolation', () => {
    it('Farmer B cannot accept Farmer A request', async () => {
      const reqRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${buyerAToken}`)
        .send({ productId: testProductId });
      const reqId = reqRes.body.data.request._id;

      // Farmer B attempts to accept
      const res = await request(app)
        .patch(`/api/requests/${reqId}/accept`)
        .set('Authorization', `Bearer ${farmerBToken}`);
      expect(res.status).toBe(403);
    });

    it('Farmer B cannot mark completion or no-show on Farmer A order', async () => {
      const reqRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${buyerAToken}`)
        .send({ productId: testProductId });
      const reqId = reqRes.body.data.request._id;

      await request(app)
        .patch(`/api/requests/${reqId}/accept`)
        .set('Authorization', `Bearer ${farmerAToken}`);

      const ordRes = await request(app)
        .post(`/api/orders/confirm-quantity/${reqId}`)
        .set('Authorization', `Bearer ${buyerAToken}`)
        .send({ quantity: 5, idempotencyKey: `idem-iso-${Date.now()}` });
      const orderId = ordRes.body.data.order._id;

      // Farmer B attempts to complete
      const compRes = await request(app)
        .patch(`/api/orders/${orderId}/complete`)
        .set('Authorization', `Bearer ${farmerBToken}`)
        .send({ fulfilledQuantity: 5 });
      expect(compRes.status).toBe(403);

      // Farmer B attempts to mark no-show
      const nsRes = await request(app)
        .patch(`/api/orders/${orderId}/no-show`)
        .set('Authorization', `Bearer ${farmerBToken}`);
      expect(nsRes.status).toBe(403);
    });

    it('Buyer B cannot confirm quantity for Buyer A request', async () => {
      const reqRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${buyerAToken}`)
        .send({ productId: testProductId });
      const reqId = reqRes.body.data.request._id;

      await request(app)
        .patch(`/api/requests/${reqId}/accept`)
        .set('Authorization', `Bearer ${farmerAToken}`);

      // Buyer B attempts to confirm
      const res = await request(app)
        .post(`/api/orders/confirm-quantity/${reqId}`)
        .set('Authorization', `Bearer ${buyerBToken}`)
        .send({ quantity: 5 });
      expect(res.status).toBe(403);
    });
  });

  // ── TEST GROUP 3: Server-side Reservation Expiration Engine ──────────────
  describe('Server-side Reservation TTL Expiration Engine', () => {
    it('automatically restores stock and transitions order status to EXPIRED', async () => {
      const initialProduct = await Product.findById(testProductId);
      const startAvailable = initialProduct.availableStock;

      // Create and confirm order for 15kg
      const reqRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${buyerAToken}`)
        .send({ productId: testProductId });
      const reqId = reqRes.body.data.request._id;

      await request(app)
        .patch(`/api/requests/${reqId}/accept`)
        .set('Authorization', `Bearer ${farmerAToken}`);

      const ordRes = await request(app)
        .post(`/api/orders/confirm-quantity/${reqId}`)
        .set('Authorization', `Bearer ${buyerAToken}`)
        .send({ quantity: 15, idempotencyKey: `idem-ttl-${Date.now()}` });
      const orderId = ordRes.body.data.order._id;

      // Stock should have decreased by 15kg
      const reservedProd = await Product.findById(testProductId);
      expect(reservedProd.availableStock).toBe(startAvailable - 15);
      expect(reservedProd.reservedStock).toBeGreaterThanOrEqual(15);

      // Simulate passage of time by backdating reservationExpiresAt
      await Order.findByIdAndUpdate(orderId, {
        reservationExpiresAt: new Date(Date.now() - 1000 * 60) // 1 minute ago
      });

      // Run backend expiration worker
      const expiredResults = await checkAndExpireReservations();
      expect(expiredResults.some((e) => e.orderId.toString() === orderId.toString())).toBe(true);

      // Verify order status is EXPIRED
      const updatedOrder = await Order.findById(orderId);
      expect(updatedOrder.status).toBe(ORDER_STATES.EXPIRED);

      // Verify stock was restored to available
      const restoredProd = await Product.findById(testProductId);
      expect(restoredProd.availableStock).toBe(startAvailable);

      // Verify absolute inventory invariant: TOTAL = AVAILABLE + RESERVED + SOLD
      expect(restoredProd.totalStock).toBe(
        restoredProd.availableStock + restoredProd.reservedStock + restoredProd.soldStock
      );

      // Running expiration again must be idempotent
      const secondRun = await checkAndExpireReservations();
      expect(secondRun.some((e) => e.orderId.toString() === orderId.toString())).toBe(false);
    });
  });

  // ── TEST GROUP 4: Partial Fulfillment Logic & Ledger Invariant ───────────
  describe('Partial Fulfillment Logic & Ledger Balance', () => {
    it('releases unfulfilled remainder back to available inventory and sets COMPLETED_PARTIAL', async () => {
      const initialProduct = await Product.findById(testProductId);
      const startAvailable = initialProduct.availableStock;
      const startSold = initialProduct.soldStock;

      // Reserve 20 kg
      const reqRes = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${buyerAToken}`)
        .send({ productId: testProductId });
      const reqId = reqRes.body.data.request._id;

      await request(app)
        .patch(`/api/requests/${reqId}/accept`)
        .set('Authorization', `Bearer ${farmerAToken}`);

      const ordRes = await request(app)
        .post(`/api/orders/confirm-quantity/${reqId}`)
        .set('Authorization', `Bearer ${buyerAToken}`)
        .send({ quantity: 20, idempotencyKey: `idem-part-${Date.now()}` });
      const orderId = ordRes.body.data.order._id;

      // Farmer only had 12 kg ready (8 kg shortfall)
      const compRes = await request(app)
        .patch(`/api/orders/${orderId}/complete`)
        .set('Authorization', `Bearer ${farmerAToken}`)
        .send({ fulfilledQuantity: 12 });

      expect(compRes.status).toBe(200);
      expect(compRes.body.data.order.status).toBe(ORDER_STATES.COMPLETED_PARTIAL);
      expect(compRes.body.data.order.fulfilledQuantity).toBe(12);

      // Product stock check:
      // Sold should increase by 12, available should increase by 8 (the remainder)
      const afterProd = await Product.findById(testProductId);
      expect(afterProd.soldStock).toBe(startSold + 12);
      expect(afterProd.availableStock).toBe(startAvailable - 12);

      // Invariant invariant: TOTAL = AVAILABLE + RESERVED + SOLD
      expect(afterProd.totalStock).toBe(
        afterProd.availableStock + afterProd.reservedStock + afterProd.soldStock
      );
    });
  });

  // ── TEST GROUP 5: Uzhavan AI Confirmation Barriers & Gate ───────────────
  describe('Uzhavan AI Confirmation Barriers & Destructive Tool Protection', () => {
    it('blocks unconfirmed destructive tool call and prompts for confirmation', async () => {
      const res = await request(app)
        .post('/api/uzhavan/tool')
        .set('Authorization', `Bearer ${farmerAToken}`)
        .send({
          toolName: 'recordOffPlatformSale',
          params: { productId: testProductId, quantity: 5, reason: 'Sold to local market' },
          confirmationGiven: false
        });

      expect(res.status).toBe(200);
      expect(res.body.data.requiresConfirmation).toBe(true);
      expect(res.body.data.toolName).toBe('recordOffPlatformSale');
    });

    it('executes destructive tool when confirmationGiven is explicitly true', async () => {
      const initialProduct = await Product.findById(testProductId);
      const startAvailable = initialProduct.availableStock;

      const res = await request(app)
        .post('/api/uzhavan/tool')
        .set('Authorization', `Bearer ${farmerAToken}`)
        .send({
          toolName: 'recordOffPlatformSale',
          params: { productId: testProductId, quantity: 4, reason: 'Sold at weekly shandy' },
          confirmationGiven: true
        });

      expect(res.status).toBe(200);
      expect(res.body.data.requiresConfirmation).toBe(false);

      const updatedProduct = await Product.findById(testProductId);
      expect(updatedProduct.availableStock).toBe(startAvailable - 4);
    });
  });
});
