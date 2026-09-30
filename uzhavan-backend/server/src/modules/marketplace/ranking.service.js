/**
 * Deterministic Marketplace Ranking Service
 * Level 7 Architecture Reference: Phase 3
 *
 * Rules:
 * - Pure, deterministic function based strictly on actual stored DB facts
 * - Never invents or fabricates scores
 * - Highly testable in isolation
 * - Outputs composite ranking score in range [0, 1]
 */

/**
 * Compute deterministic ranking score for a produce listing
 *
 * @param {object} product - Product with availableStock, pricePerUnit, category, harvestDate
 * @param {object} options
 * @param {number} options.distanceKm - Haversine distance in km from buyer
 * @param {number} options.maxRadiusKm - Search radius in km
 * @param {number} options.freshnessScore - Score [0, 1] derived from harvest date & category
 * @param {boolean} options.isVerifiedFarmer - Whether farmer is verified
 * @param {number} options.categoryAvgPrice - Average price in category for normalization
 * @returns {{ score: number, breakdown: object }}
 */
export function computeDeterministicRank(product, {
  distanceKm = 0,
  maxRadiusKm = 30,
  freshnessScore = 1,
  isVerifiedFarmer = false,
  categoryAvgPrice = null
} = {}) {
  // 1. Proximity factor [0, 1]: 1.0 at 0km, down to 0 at maxRadiusKm
  const safeRadius = Math.max(1, maxRadiusKm);
  const proximityFactor = Math.max(0, 1 - Math.min(distanceKm, safeRadius) / safeRadius);

  // 2. Freshness urgency factor [0, 1]:
  // Produce harvested recently or in prime window gets high score
  const safeFreshness = Math.max(0, Math.min(1, freshnessScore));

  // 3. Price competitiveness [0, 1]:
  // If category average price is available, compare against it. Otherwise normalize by price itself.
  let priceFactor = 0.5;
  if (categoryAvgPrice && categoryAvgPrice > 0 && product.pricePerUnit > 0) {
    // If price <= average, score between 0.5 and 1.0; if > average, score between 0.1 and 0.5
    const ratio = product.pricePerUnit / categoryAvgPrice;
    priceFactor = Math.max(0.1, Math.min(1.0, 1.0 - (ratio - 1) * 0.5));
  } else if (product.pricePerUnit > 0) {
    priceFactor = Math.max(0.2, Math.min(1.0, 100 / (100 + product.pricePerUnit)));
  }

  // 4. Farmer verification trust factor [0.7, 1.0]
  const trustFactor = isVerifiedFarmer ? 1.0 : 0.7;

  // 5. Stock availability factor [0.5, 1.0]
  const stockFactor = product.availableStock > 0 ? (product.availableStock >= 10 ? 1.0 : 0.7) : 0;

  // Composite Weighted Score:
  // Proximity: 30%, Freshness: 25%, Price: 20%, Trust: 15%, Stock: 10%
  const compositeScore =
    0.30 * proximityFactor +
    0.25 * safeFreshness +
    0.20 * priceFactor +
    0.15 * trustFactor +
    0.10 * stockFactor;

  return {
    score: parseFloat(compositeScore.toFixed(3)),
    breakdown: {
      proximityFactor: parseFloat(proximityFactor.toFixed(2)),
      freshnessFactor: parseFloat(safeFreshness.toFixed(2)),
      priceFactor: parseFloat(priceFactor.toFixed(2)),
      trustFactor,
      stockFactor
    }
  };
}
