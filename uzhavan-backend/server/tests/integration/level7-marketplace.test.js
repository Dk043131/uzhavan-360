import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/api/app.js';
import { connectDB } from '../../src/config/db.js';
import { User } from '../../src/modules/auth/user.model.js';
import { Product } from '../../src/modules/products/product.model.js';
import { Order } from '../../src/modules/orders/order.model.js';
import { BuyerRequest } from '../../src/modules/requests/request.model.js';
import { HarvestByproduct } from '../../src/modules/byproducts/byproduct.model.js';
import { computeDeterministicRank } from '../../src/modules/marketplace/ranking.service.js';
import { computeFreshnessTier, computeFreshnessDetails } from '../../src/utils/freshness.js';
import { ROLES, UNITS, FRESHNESS_TIERS, ORDER_STATES } from '@uzhavan360/shared';

describe('Level 7: Production Integration, Marketplace Intelligence & System Validation', () => {
  let adminToken, farmerToken, buyerToken;
  let adminId, farmerId, buyerId;
  let testProductId;

  beforeAll(async () => {
    await connectDB();

    // Clean test users
    await User.deleteMany({
      phone: { $in: ['9666000001', '9666000002', '9666000003'] }
    });

    // 1. Admin
    const admRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Platform Admin Senthil',
        phone: '9666000001',
        password: 'password123',
        role: ROLES.ADMIN
      });
    adminToken = admRes.body.data.token;
    adminId = admRes.body.data.user._id || admRes.body.data.user.id;

    // 2. Farmer
    const fRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Farmer Kandasamy',
        phone: '9666000002',
        password: 'password123',
        role: ROLES.FARMER,
        farmDetails: {
          farmName: 'Kandasamy Naturals',
          address: { village: 'Kinathukadavu', district: 'Coimbatore' },
          location: { type: 'Point', coordinates: [76.98, 10.82] }
        }
      });
    farmerToken = fRes.body.data.token;
    farmerId = fRes.body.data.user._id || fRes.body.data.user.id;

    // 3. Buyer
    const bRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Buyer Priya',
        phone: '9666000003',
        password: 'password123',
        role: ROLES.BUYER,
        buyerDetails: { businessType: 'RESTAURANT' }
      });
    buyerToken = bRes.body.data.token;
    buyerId = bRes.body.data.user._id || bRes.body.data.user.id;

    // Create test product for farmer
    const pRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        name: 'Organic Okra (Vendakkai)',
        category: 'FRUITING',
        quantity: 80,
        unit: UNITS.KG,
        pricePerUnit: 40,
        harvestDate: new Date(),
        latitude: 10.82,
        longitude: 76.98
      });
    testProductId = pRes.body.data.product._id;
  });

  afterAll(async () => {
    if (testProductId) {
      await Product.findByIdAndDelete(testProductId);
      await BuyerRequest.deleteMany({ productId: testProductId });
      await Order.deleteMany({ productId: testProductId });
    }
    await HarvestByproduct.deleteMany({ farmerId });
    await User.deleteMany({
      phone: { $in: ['9666000001', '9666000002', '9666000003'] }
    });
  });

  // ── TEST GROUP 1: Deterministic Ranking Service ─────────────────────────
  describe('Deterministic Marketplace Ranking Service', () => {
    it('computes deterministic ranking score strictly bounded in [0, 1]', () => {
      const mockProduct = {
        name: 'Brinjal',
        availableStock: 50,
        pricePerUnit: 30,
        category: 'FRUITING'
      };

      const result = computeDeterministicRank(mockProduct, {
        distanceKm: 5,
        maxRadiusKm: 30,
        freshnessScore: 0.95,
        isVerifiedFarmer: true,
        categoryAvgPrice: 35
      });

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.breakdown).toHaveProperty('proximityFactor');
      expect(result.breakdown).toHaveProperty('freshnessFactor');
      expect(result.breakdown).toHaveProperty('priceFactor');
      expect(result.breakdown).toHaveProperty('trustFactor', 1.0);
    });

    it('gives unverified farmer a lower trust factor than verified farmer', () => {
      const mockProduct = { availableStock: 50, pricePerUnit: 30 };
      const verified = computeDeterministicRank(mockProduct, { isVerifiedFarmer: true });
      const unverified = computeDeterministicRank(mockProduct, { isVerifiedFarmer: false });

      expect(verified.score).toBeGreaterThan(unverified.score);
      expect(verified.breakdown.trustFactor).toBe(1.0);
      expect(unverified.breakdown.trustFactor).toBe(0.7);
    });

    it('supports sorting options in marketplace API', async () => {
      // Create a second product with higher price
      const p2 = await Product.create({
        farmerId,
        name: 'Premium Spinach (Keerai)',
        category: 'LEAFY',
        availableStock: 25,
        totalStock: 25,
        pricePerUnit: 60,
        harvestDate: new Date(),
        unit: UNITS.KG,
        location: { type: 'Point', coordinates: [76.98, 10.82] }
      });

      // Price ASC
      const resAsc = await request(app)
        .get('/api/marketplace?sortBy=price_asc')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(resAsc.status).toBe(200);
      expect(resAsc.body.data.items.length).toBeGreaterThanOrEqual(2);
      expect(resAsc.body.data.items[0].pricePerUnit).toBeLessThanOrEqual(resAsc.body.data.items[1].pricePerUnit);

      // Price DESC
      const resDesc = await request(app)
        .get('/api/marketplace?sortBy=price_desc')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(resDesc.status).toBe(200);
      expect(resDesc.body.data.items[0].pricePerUnit).toBeGreaterThanOrEqual(resDesc.body.data.items[1].pricePerUnit);

      await Product.findByIdAndDelete(p2._id);
    });
  });

  // ── TEST GROUP 2: Freshness / Sell-Soon Calculations ────────────────────
  describe('Freshness & Sell-Soon Classification', () => {
    it('classifies recently harvested produce as FRESH_HARVEST', () => {
      const justHarvested = new Date(); // now
      const tier = computeFreshnessTier(justHarvested, 'LEAFY'); // 48h shelf life
      expect(tier).toBe(FRESHNESS_TIERS.FRESH_HARVEST);
    });

    it('classifies aging produce as SELL_SOON or URGENT', () => {
      // Leafy shelf life is 48 hours. 40 hours ago = 40/48 = 0.83 -> SELL_SOON
      const sellSoonDate = new Date(Date.now() - 40 * 60 * 60 * 1000);
      const tier = computeFreshnessTier(sellSoonDate, 'LEAFY');
      expect(tier).toBe(FRESHNESS_TIERS.SELL_SOON);

      // 45 hours ago = 45/48 = 0.93 -> URGENT in details
      const urgentDate = new Date(Date.now() - 45 * 60 * 60 * 1000);
      const details = computeFreshnessDetails(urgentDate, 'LEAFY');
      expect(details.urgencyLevel).toBe('URGENT');
    });

    it('provides explainable freshness details and remaining shelf-life', () => {
      const harvestDate = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
      const details = computeFreshnessDetails(harvestDate, 'LEAFY'); // 48 hours total

      expect(details.totalShelfHours).toBe(48);
      expect(details.elapsedHours).toBeCloseTo(12, 0);
      expect(details.remainingShelfHours).toBeCloseTo(36, 0);
      expect(details.aiInterpretation).toMatch(/Peak Farmgate Freshness|prime consumer/i);
    });
  });

  // ── TEST GROUP 3: Demand Signals & Telemetry ────────────────────────────
  describe('Empirical Demand Signals & Telemetry', () => {
    it('returns empirical 7-day requested and completed quantities without mock numbers', async () => {
      const res = await request(app)
        .get('/api/demand/signals?category=FRUITING&radiusKm=50');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('requestedQuantity7Days');
      expect(res.body.data).toHaveProperty('completedQuantity7Days');
      expect(res.body.data).toHaveProperty('trendSignal');
      expect(res.body.data.disclaimer).toMatch(/strictly on internal Uzhavan 360/i);
    });

    it('provides farmer harvest decision support with explainable guidance and disclaimer', async () => {
      const res = await request(app)
        .get('/api/demand/decision-support')
        .set('Authorization', `Bearer ${farmerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('insights');
      expect(Array.isArray(res.body.data.insights)).toBe(true);

      if (res.body.data.insights.length > 0) {
        const item = res.body.data.insights[0];
        expect(item).toHaveProperty('explanation');
        expect(item).toHaveProperty('guidance');
        expect(item.disclaimer).toMatch(/not a financial promise or guaranteed sale/i);
      }
    });

    it('matches buyer demand with nearby available farm supply with explainable rationale', async () => {
      const res = await request(app)
        .get('/api/demand/match-supply?category=FRUITING&requiredQuantity=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('matches');
      if (res.body.data.matches.length > 0) {
        const match = res.body.data.matches[0];
        expect(match).toHaveProperty('explanation');
        expect(match.explanation).toMatch(/available\. Estimated distance/i);
      }
    });
  });

  // ── TEST GROUP 4: Byproduct Marketplace ──────────────────────────────────
  describe('Agricultural Byproduct Marketplace', () => {
    it('creates and discovers byproduct listings across expanded categories', async () => {
      const createRes = await request(app)
        .post('/api/byproducts')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          name: 'Golden Paddy Straw Bales',
          category: 'PADDY_STRAW',
          quantity: 5,
          unit: UNITS.TON,
          expectedPrice: 1200,
          latitude: 10.82,
          longitude: 76.98,
          packagingType: 'BALED',
          moistureLevel: 'LOW'
        });

      expect(createRes.status).toBe(201);
      const byproductId = createRes.body.data.byproduct._id;

      // Public discovery search by category
      const searchRes = await request(app)
        .get('/api/byproducts?category=PADDY_STRAW&search=Straw');

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.items.some((b) => b._id.toString() === byproductId.toString())).toBe(true);

      // Clean up
      await HarvestByproduct.findByIdAndDelete(byproductId);
    });
  });

  // ── TEST GROUP 5: Admin Platform Overview & Role Enforcement ────────────
  describe('Admin Platform Capabilities & RBAC', () => {
    it('blocks regular buyer or farmer from accessing admin overview', async () => {
      const buyerRes = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${buyerToken}`);
      expect(buyerRes.status).toBe(403);

      const farmerRes = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${farmerToken}`);
      expect(farmerRes.status).toBe(403);
    });

    it('allows admin to retrieve complete platform telemetry overview', async () => {
      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data).toHaveProperty('products');
      expect(res.body.data).toHaveProperty('orders');
      expect(res.body.data).toHaveProperty('inventory');
      expect(res.body.data).toHaveProperty('aiObservability');
    });

    it('allows admin to verify farmer profile', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${farmerId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isVerified: true });

      expect(res.status).toBe(200);
      expect(res.body.data.isVerified).toBe(true);

      const updatedUser = await User.findById(farmerId);
      expect(updatedUser.isVerified).toBe(true);
    });
  });
});
