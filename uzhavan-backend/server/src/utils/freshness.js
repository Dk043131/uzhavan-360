import { FRESHNESS_TIERS } from '@uzhavan360/shared';

/**
 * Freshness Utility Functions
 * Level 1 Architecture Reference: Section 13 — Freshness Priority Architecture
 *
 * IMPORTANT SEPARATION:
 *   Stored empirical facts (harvest timestamp, category) → in DB
 *   System-derived urgency tier → computed here dynamically
 */

// Approximate shelf lives in hours per product category
const SHELF_LIVES_HOURS = Object.freeze({
  LEAFY:       48,   // Spinach, methi, coriander, etc.
  FLOWER:      24,
  FRUITING:    168,  // Tomatoes, okra, brinjal (7 days)
  TUBER:       720,  // Onion, potato (30 days)
  ROOT:        480,  // Carrots, beets
  GRAIN:       8760, // Rice, maize (365 days)
  CITRUS:      336,  // Oranges, lemon (14 days)
  OTHER:       240   // Default: 10 days
});

/**
 * Compute freshness tier for a product batch.
 *
 * @param {Date|string} harvestDate - When the produce was harvested
 * @param {string} category - Product category key (e.g. 'FRUITING', 'LEAFY')
 * @returns {'FRESH_HARVEST'|'NORMAL'|'SELL_SOON'|'URGENT'}
 */
export function computeFreshnessTier(harvestDate, category = 'OTHER') {
  const shelfLifeHours = SHELF_LIVES_HOURS[category.toUpperCase()] ?? SHELF_LIVES_HOURS.OTHER;
  const harvestMs = new Date(harvestDate).getTime();
  const nowMs = Date.now();
  const elapsedHours = Math.max(0, (nowMs - harvestMs) / (1000 * 60 * 60));
  const elapsedFraction = elapsedHours / shelfLifeHours;

  if (elapsedFraction < 0.33) return FRESHNESS_TIERS.FRESH_HARVEST;
  if (elapsedFraction < 0.75) return FRESHNESS_TIERS.NORMAL;
  return FRESHNESS_TIERS.SELL_SOON;
}

/**
 * Compute detailed, explainable freshness metadata.
 *
 * @param {Date|string} harvestDate
 * @param {string} category
 * @returns {{ tier: string, score: number, elapsedHours: number, totalShelfHours: number, remainingShelfHours: number, isSellSoon: boolean, aiInterpretation: string }}
 */
export function computeFreshnessDetails(harvestDate, category = 'OTHER') {
  const shelfLifeHours = SHELF_LIVES_HOURS[category.toUpperCase()] ?? SHELF_LIVES_HOURS.OTHER;
  const harvestMs = new Date(harvestDate).getTime();
  const nowMs = Date.now();
  const elapsedHours = parseFloat(Math.max(0, (nowMs - harvestMs) / (1000 * 60 * 60)).toFixed(1));
  const remainingShelfHours = parseFloat(Math.max(0, shelfLifeHours - elapsedHours).toFixed(1));
  const tier = computeFreshnessTier(harvestDate, category);
  const score = computeFreshnessScore(harvestDate, category);

  const elapsedFraction = elapsedHours / shelfLifeHours;
  const isUrgent = elapsedFraction >= 0.85;
  const urgencyLevel = isUrgent ? 'URGENT' : (tier === FRESHNESS_TIERS.SELL_SOON ? 'SELL_SOON' : (tier === FRESHNESS_TIERS.FRESH_HARVEST ? 'FRESH' : 'NORMAL'));

  let aiInterpretation = 'Produce is within prime consumer freshness window.';
  if (isUrgent) {
    aiInterpretation = 'AI Suggested Action: Approaching end of shelf-life. Recommend priority pickup or discounting to prevent loss.';
  } else if (tier === FRESHNESS_TIERS.SELL_SOON) {
    aiInterpretation = 'AI Suggested Action: Produce should be moved in the next 24-48 hours.';
  } else if (tier === FRESHNESS_TIERS.FRESH_HARVEST) {
    aiInterpretation = 'Peak Farmgate Freshness: Harvested within today\'s production cycle.';
  }

  return {
    tier,
    urgencyLevel,
    score,
    elapsedHours,
    totalShelfHours: shelfLifeHours,
    remainingShelfHours,
    isSellSoon: tier === FRESHNESS_TIERS.SELL_SOON || isUrgent,
    aiInterpretation
  };
}

/**
 * Compute freshness score [0, 1] for discovery ranking.
 * Fresh = 1.0, Sell Soon approaching 0 = maximum urgency boost
 *
 * @param {Date|string} harvestDate
 * @param {string} category
 * @returns {number} score in [0, 1]
 */
export function computeFreshnessScore(harvestDate, category = 'OTHER') {
  const shelfLifeHours = SHELF_LIVES_HOURS[category.toUpperCase()] ?? SHELF_LIVES_HOURS.OTHER;
  const elapsedHours = (Date.now() - new Date(harvestDate).getTime()) / (1000 * 60 * 60);
  return Math.max(0, 1 - elapsedHours / shelfLifeHours);
}

export { SHELF_LIVES_HOURS };
