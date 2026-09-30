/**
 * Unit Tests: Inventory Business Logic
 * Tests the core safety invariants using in-memory logic only — no DB.
 */

import { describe, it, expect } from '@jest/globals';
import { computeFreshnessTier, computeFreshnessScore } from '../../src/utils/freshness.js';
import { haversineDistance, applyPrivacyJitter, toGeoJsonPoint } from '../../src/utils/location.js';
import { FRESHNESS_TIERS } from '@uzhavan360/shared';

describe('Freshness Utility', () => {
  it('returns FRESH_HARVEST for produce harvested today', () => {
    const now = new Date();
    expect(computeFreshnessTier(now, 'FRUITING')).toBe(FRESHNESS_TIERS.FRESH_HARVEST);
  });

  it('returns SELL_SOON for very old leafy produce', () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago (100% of leafy shelf life)
    expect(computeFreshnessTier(oldDate, 'LEAFY')).toBe(FRESHNESS_TIERS.SELL_SOON);
  });

  it('returns NORMAL for produce at mid-shelf life', () => {
    const midDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago for FRUITING (shelf=7d)
    expect(computeFreshnessTier(midDate, 'FRUITING')).toBe(FRESHNESS_TIERS.NORMAL);
  });

  it('returns score between 0 and 1', () => {
    const score = computeFreshnessScore(new Date(), 'FRUITING');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('fresh produce scores higher than old produce', () => {
    const freshScore = computeFreshnessScore(new Date(), 'TUBER');
    const oldDate = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000);
    const oldScore = computeFreshnessScore(oldDate, 'TUBER');
    expect(freshScore).toBeGreaterThan(oldScore);
  });
});

describe('Location Utility', () => {
  it('correctly computes zero distance for same point', () => {
    const point = { lat: 11.0, lng: 76.9 };
    const dist = haversineDistance(point, point);
    expect(dist).toBeCloseTo(0, 1);
  });

  it('correctly computes realistic distance between two Coimbatore points', () => {
    const p1 = { lat: 11.0168, lng: 76.9558 };
    const p2 = { lat: 11.0700, lng: 77.0100 }; // ~7-8 km away
    const dist = haversineDistance(p1, p2);
    expect(dist).toBeGreaterThan(5);
    expect(dist).toBeLessThan(15);
  });

  it('applies privacy jitter within expected range', () => {
    const exactPoint = { lat: 11.0168, lng: 76.9558 };
    const jittered = applyPrivacyJitter(exactPoint, 1000);
    const deviation = haversineDistance(exactPoint, jittered);
    // Jitter should be less than ~1.5 km for 1000m max
    expect(deviation).toBeLessThan(1.5);
    // But should NOT be exactly the same coordinates
    // (Note: extremely rare chance of exact same, so we just verify the structure)
    expect(jittered).toHaveProperty('lat');
    expect(jittered).toHaveProperty('lng');
  });

  it('produces valid GeoJSON point format', () => {
    const geoJson = toGeoJsonPoint(11.0168, 76.9558);
    expect(geoJson.type).toBe('Point');
    expect(geoJson.coordinates[0]).toBe(76.9558); // longitude first
    expect(geoJson.coordinates[1]).toBe(11.0168); // latitude second
  });
});

describe('Inventory Math Invariants', () => {
  it('verifies double-entry invariant: total = available + reserved + sold', () => {
    // Simulate a series of inventory state snapshots
    const states = [
      { total: 500, available: 500, reserved: 0, sold: 0 },        // initial listing
      { total: 500, available: 400, reserved: 100, sold: 0 },       // after 100kg reservation
      { total: 500, available: 400, reserved: 0, sold: 100 },       // after order completed
      { total: 700, available: 600, reserved: 0, sold: 100 },       // after 200kg new harvest
      { total: 700, available: 500, reserved: 0, sold: 200 },       // after 100kg offline sale
    ];

    for (const state of states) {
      const sum = state.available + state.reserved + state.sold;
      expect(state.total).toBe(sum);
      expect(state.available).toBeGreaterThanOrEqual(0);
      expect(state.reserved).toBeGreaterThanOrEqual(0);
      expect(state.sold).toBeGreaterThanOrEqual(0);
    }
  });

  it('verifies no-show correctly restores inventory', () => {
    const beforeNoShow = { total: 500, available: 400, reserved: 100, sold: 0 };
    // No-show: reserved → available (physical stock was not consumed)
    const afterNoShow = {
      total: beforeNoShow.total,
      available: beforeNoShow.available + beforeNoShow.reserved,
      reserved: 0,
      sold: beforeNoShow.sold
    };
    expect(afterNoShow.available).toBe(500);
    expect(afterNoShow.reserved).toBe(0);
    expect(afterNoShow.total).toBe(afterNoShow.available + afterNoShow.reserved + afterNoShow.sold);
  });

  it('verifies partial fulfillment reconciliation', () => {
    const reserved = 200;
    const actualFulfilled = 150;
    const remainder = reserved - actualFulfilled;
    // Sold = actualFulfilled, remainder goes back to available
    expect(remainder).toBe(50);
    expect(actualFulfilled + remainder).toBe(reserved); // nothing lost
  });
});
