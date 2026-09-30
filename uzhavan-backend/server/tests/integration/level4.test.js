import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/api/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { User } from '../../src/modules/auth/user.model.js';
import { Product } from '../../src/modules/products/product.model.js';
import { BuyerRequest } from '../../src/modules/requests/request.model.js';
import { Order } from '../../src/modules/orders/order.model.js';
import { InventoryLot } from '../../src/modules/inventory/inventoryLot.model.js';
import { InventoryLedger } from '../../src/modules/inventory/inventoryLedger.model.js';
import { FarmerProfile } from '../../src/modules/farmers/farmerProfile.model.js';
import { BuyerProfile } from '../../src/modules/buyers/buyerProfile.model.js';
import { DemandSignal } from '../../src/modules/demand/demandSignal.model.js';
import { UzhavanConversation } from '../../src/modules/uzhavan/uzhavanConversation.model.js';
import { UzhavanAuditLog } from '../../src/modules/uzhavan/uzhavanAuditLog.model.js';
import * as inventoryService from '../../src/modules/inventory/inventory.service.js';
import * as orderService from '../../src/modules/orders/orders.service.js';
import * as uzhavanService from '../../src/modules/uzhavan/uzhavan.service.js';
import { ROLES, UNITS, INVENTORY_TRANSACTION_TYPES, ORDER_STATES } from '@uzhavan360/shared';

describe('Level 4: Database, Inventory Concurrency, Uzhavan AI & Map Abstraction', () => {
  let farmerToken;
  let buyerToken;
  let buyer2Token;
  let farmerUser;
  let buyerUser;
  let buyer2User;
  let testProduct;

  beforeAll(async () => {
    await connectDB();

    // Clean up test accounts
    await User.deleteMany({ phone: { $in: ['9999000001', '9999000002', '9999000003'] } });

    // Setup test farmer
    const farmerPhone = '9999000001';
    const fRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'L4 Farmer Velu',
        phone: farmerPhone,
        password: 'password123',
        role: ROLES.FARMER,
        farmDetails: {
          farmName: 'Velu Farm Hub',
          location: { type: 'Point', coordinates: [76.9558, 11.0168] },
          address: { district: 'Coimbatore', village: 'Sulur' }
        }
      });
    farmerToken = fRes.body.data.token;
    farmerUser = fRes.body.data.user;
    farmerUser.id = farmerUser._id;

    // Setup buyer 1
    const buyerPhone = '9999000002';
    const bRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'L4 Buyer Anitha',
        phone: buyerPhone,
        password: 'password123',
        role: ROLES.BUYER
      });
    buyerToken = bRes.body.data.token;
    buyerUser = bRes.body.data.user;
    buyerUser.id = buyerUser._id;

    // Setup buyer 2
    const buyer2Phone = '9999000003';
    const b2Res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'L4 Buyer Karthik',
        phone: buyer2Phone,
        password: 'password123',
        role: ROLES.BUYER
      });
    buyer2Token = b2Res.body.data.token;
    buyer2User = b2Res.body.data.user;
    buyer2User.id = buyer2User._id;
  });

  afterAll(async () => {
    // Clean up test records
    if (farmerUser?._id) {
      await Product.deleteMany({ farmerId: farmerUser._id });
      await FarmerProfile.deleteMany({ userId: farmerUser._id });
      await UzhavanConversation.deleteMany({ userId: farmerUser._id });
      await UzhavanAuditLog.deleteMany({ userId: farmerUser._id });
      await User.deleteOne({ _id: farmerUser._id });
    }
    if (buyerUser?._id) {
      await BuyerProfile.deleteMany({ userId: buyerUser._id });
      await UzhavanConversation.deleteMany({ userId: buyerUser._id });
      await UzhavanAuditLog.deleteMany({ userId: buyerUser._id });
      await User.deleteOne({ _id: buyerUser._id });
    }
    if (buyer2User?._id) {
      await User.deleteOne({ _id: buyer2User._id });
    }
    await disconnectDB();
  });

  // ── 1. Database Models & Schema Validation ───────────────────────────────
  describe('1. Database Schemas & Profiles', () => {
    it('creates and retrieves FarmerProfile with geospatial location', async () => {
      const profile = await FarmerProfile.create({
        userId: farmerUser.id,
        farmName: 'Velu Farm Hub',
        acreage: 5,
        farmingPractice: 'ORGANIC',
        location: { type: 'Point', coordinates: [76.9558, 11.0168] },
        address: { district: 'Coimbatore', village: 'Sulur' }
      });

      expect(profile._id).toBeDefined();
      expect(profile.farmingPractice).toBe('ORGANIC');
      expect(profile.location.type).toBe('Point');
      expect(profile.location.coordinates[0]).toBe(76.9558);
    });

    it('creates and retrieves BuyerProfile', async () => {
      const profile = await BuyerProfile.create({
        userId: buyerUser.id,
        businessName: 'Anitha Fresh Mart',
        businessType: 'RETAIL',
        preferredCategories: ['FRUITING', 'LEAFY']
      });

      expect(profile._id).toBeDefined();
      expect(profile.businessType).toBe('RETAIL');
      expect(profile.reliabilityScore).toBe(100);
    });

    it('creates InventoryLot linked to product and enforces lot uniqueness per farmer', async () => {
      // First create product
      testProduct = await Product.create({
        farmerId: farmerUser.id,
        name: 'L4 Fresh Tomatoes',
        category: 'FRUITING',
        unit: UNITS.KG,
        pricePerUnit: 40,
        totalStock: 500,
        availableStock: 500,
        reservedStock: 0,
        soldStock: 0,
        harvestDate: new Date(),
        location: { type: 'Point', coordinates: [76.9558, 11.0168] },
        isAvailable: true
      });

      const lot = await InventoryLot.create({
        productId: testProduct._id,
        farmerId: farmerUser.id,
        lotNumber: 'LOT-TEST-001',
        harvestDate: new Date(),
        initialQuantity: 500,
        availableQuantity: 500,
        reservedQuantity: 0,
        soldQuantity: 0,
        unit: UNITS.KG,
        qualityGrade: 'ORGANIC_PREMIUM'
      });

      expect(lot._id).toBeDefined();
      expect(lot.lotNumber).toBe('LOT-TEST-001');

      // Duplicate lot number for same farmer must fail unique constraint
      await expect(
        InventoryLot.create({
          productId: testProduct._id,
          farmerId: farmerUser.id,
          lotNumber: 'LOT-TEST-001',
          initialQuantity: 100,
          availableQuantity: 100
        })
      ).rejects.toThrow();
    });
  });

  // ── 2. Geospatial Discovery & Map Abstraction ────────────────────────────
  describe('2. Geospatial Discovery & Map Abstraction', () => {
    it('GET /api/marketplace returns products within search radius using 2dsphere index', async () => {
      const res = await request(app)
        .get('/api/marketplace?lat=11.0168&lng=76.9558&radius=25')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      const found = res.body.data.items.find((p) => p._id === testProduct._id.toString());
      expect(found).toBeDefined();
      expect(found.fuzzedLocation).toBeDefined(); // Privacy jitter verified
    });

    it('Health endpoint confirms mapProvider is abstract with zero Google Maps dependency', async () => {
      const res = await request(app).get('/api/health').expect(200);
      expect(res.body.data.integrations.mapProvider).toBeDefined();
      expect(res.body.data.integrations.mapProvider.status).toBe('ready');
      expect(res.body.data.integrations.mapProvider.type).toContain('OSM');
      expect(res.body.data.integrations.googleMaps).toBeUndefined(); // Google Maps eliminated
    });
  });

  // ── 3. Critical Concurrency & Inventory Invariants ───────────────────────
  describe('3. Critical Concurrency & Inventory Invariants', () => {
    it('enforces atomic reservation: 500kg stock, simultaneous requests of 400kg and 300kg MUST NOT allow over-reservation or negative stock', async () => {
      // Step A: Farmer creates a fresh product with exactly 500kg
      const concurrencyProduct = await Product.create({
        farmerId: farmerUser.id,
        name: 'Concurrency Test Chilli',
        category: 'FRUITING',
        unit: UNITS.KG,
        pricePerUnit: 60,
        totalStock: 500,
        availableStock: 500,
        reservedStock: 0,
        soldStock: 0,
        harvestDate: new Date(),
        location: { type: 'Point', coordinates: [76.9558, 11.0168] },
        isAvailable: true
      });

      // Step B: Buyer A submits request and Farmer accepts it
      const reqA = await BuyerRequest.create({
        buyerId: buyerUser.id,
        farmerId: farmerUser.id,
        productId: concurrencyProduct._id,
        status: 'ACCEPTED'
      });

      // Step C: Buyer B submits request and Farmer accepts it
      const reqB = await BuyerRequest.create({
        buyerId: buyer2User.id,
        farmerId: farmerUser.id,
        productId: concurrencyProduct._id,
        status: 'ACCEPTED'
      });

      // Step D: Simultaneous reservation race condition!
      // Buyer A attempts 400kg, Buyer B attempts 300kg.
      // Total requested = 700kg > 500kg.
      const reservationPromises = [
        orderService
          .confirmQuantityAndReserve({
            requestId: reqA._id.toString(),
            buyerId: buyerUser.id,
            quantity: 400,
            idempotencyKey: 'idem-race-A'
          })
          .then((res) => ({ status: 'fulfilled', result: res }))
          .catch((err) => ({ status: 'rejected', error: err })),

        orderService
          .confirmQuantityAndReserve({
            requestId: reqB._id.toString(),
            buyerId: buyer2User.id,
            quantity: 300,
            idempotencyKey: 'idem-race-B'
          })
          .then((res) => ({ status: 'fulfilled', result: res }))
          .catch((err) => ({ status: 'rejected', error: err }))
      ];

      const results = await Promise.all(reservationPromises);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly ONE must succeed and ONE must fail with conflict (409)
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(rejected[0].error.statusCode).toBe(409);

      // Inspect Product in DB — invariant MUST hold:
      const updatedProduct = await Product.findById(concurrencyProduct._id);
      expect(updatedProduct.availableStock).toBeGreaterThanOrEqual(0);
      expect(updatedProduct.reservedStock).toBeLessThanOrEqual(500);
      expect(
        updatedProduct.availableStock + updatedProduct.reservedStock + updatedProduct.soldStock
      ).toBe(updatedProduct.totalStock);

      // Clean up
      await Product.deleteOne({ _id: concurrencyProduct._id });
      await BuyerRequest.deleteMany({ productId: concurrencyProduct._id });
      await Order.deleteMany({ productId: concurrencyProduct._id });
    });

    it('verifies idempotency: repeating the same confirmation returns existing order without double-reserving', async () => {
      const p = await Product.create({
        farmerId: farmerUser.id,
        name: 'Idempotency Mango',
        category: 'FRUITING',
        unit: UNITS.KG,
        pricePerUnit: 80,
        totalStock: 200,
        availableStock: 200,
        reservedStock: 0,
        soldStock: 0,
        harvestDate: new Date(),
        location: { type: 'Point', coordinates: [76.9558, 11.0168] },
        isAvailable: true
      });

      const req = await BuyerRequest.create({
        buyerId: buyerUser.id,
        farmerId: farmerUser.id,
        productId: p._id,
        status: 'ACCEPTED'
      });

      const key = `idem-key-${Date.now()}`;
      const order1 = await orderService.confirmQuantityAndReserve({
        requestId: req._id.toString(),
        buyerId: buyerUser.id,
        quantity: 50,
        idempotencyKey: key
      });

      const order2 = await orderService.confirmQuantityAndReserve({
        requestId: req._id.toString(),
        buyerId: buyerUser.id,
        quantity: 50,
        idempotencyKey: key
      });

      expect(order1.id.toString()).toBe(order2.id.toString());

      // Reserved stock should only be 50, NOT 100!
      const checkP = await Product.findById(p._id);
      expect(checkP.reservedStock).toBe(50);
      expect(checkP.availableStock).toBe(150);

      // Clean up
      await Product.deleteOne({ _id: p._id });
      await BuyerRequest.deleteOne({ _id: req._id });
      await Order.deleteOne({ _id: order1.id });
    });
  });

  // ── 4. Uzhavan AI Layer: Multi-turn, Tools, RBAC & Audit ────────────────
  describe('4. Uzhavan AI Layer: Tools, Context & Audit Log', () => {
    it('GET /api/uzhavan returns 20+ active tools and status', async () => {
      const res = await request(app).get('/api/uzhavan').expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalTools).toBeGreaterThanOrEqual(20);
      expect(res.body.data.aiProvider).toBe('gemini');
    });

    it('enforces RBAC on tools: buyer calling farmer-only tool gets 403', async () => {
      const res = await request(app)
        .post('/api/uzhavan/tool')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          toolName: 'createProduct',
          params: { name: 'Illegal Tomato' }
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not available for your role');
    });

    it('requires confirmation for destructive tools (e.g. deleteProduct, recordOffPlatformSale)', async () => {
      const res = await request(app)
        .post('/api/uzhavan/tool')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          toolName: 'deleteProduct',
          params: { productId: testProduct._id.toString() },
          confirmationGiven: false
        })
        .expect(200);

      expect(res.body.data.requiresConfirmation).toBe(true);
      expect(res.body.data.confirmationPrompt).toBeDefined();
    });

    it('creates UzhavanAuditLog entry for tool executions', async () => {
      // Execute a non-destructive tool
      await request(app)
        .post('/api/uzhavan/tool')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          toolName: 'getMyProducts',
          params: {}
        })
        .expect(200);

      const logs = await UzhavanAuditLog.find({ userId: farmerUser.id });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].toolSelected).toBeDefined();
    });
  });
});
