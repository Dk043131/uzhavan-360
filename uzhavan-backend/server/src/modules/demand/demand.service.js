import { BuyerRequest } from '../requests/request.model.js';
import { Product } from '../products/product.model.js';
import { Order } from '../orders/order.model.js';
import { DEMAND_TRENDS } from '@uzhavan360/shared';
import { haversineDistance } from '../../utils/location.js';

/**
 * Calculate localized market demand intelligence for a commodity
 * Uses strictly empirical transaction and request telemetry (no invented numbers)
 */
export async function getCommodityDemandSignals({ category, lat, lng, radiusKm = 30 } = {}) {
  const centerLat = parseFloat(lat ?? 11.0168);
  const centerLng = parseFloat(lng ?? 76.9558);
  const maxRadius = parseFloat(radiusKm);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // 1. Fetch Orders from past 14 days
  const orders = await Order.find({
    createdAt: { $gte: fourteenDaysAgo }
  }).populate('productId', 'category location name');

  // 2. Fetch BuyerRequests from past 14 days
  const requests = await BuyerRequest.find({
    createdAt: { $gte: fourteenDaysAgo }
  }).populate('productId', 'category location name');

  let current7DaysRequestedQty = 0;
  let previous7DaysRequestedQty = 0;
  let current7DaysCompletedQty = 0;
  let current7DaysRequestCount = 0;
  let previous7DaysRequestCount = 0;

  for (const ord of orders) {
    if (!ord.productId) continue;
    if (category && category !== 'ALL' && ord.productId.category !== category.toUpperCase()) continue;

    const coords = {
      lng: ord.productId.location?.coordinates?.[0] ?? 76.9558,
      lat: ord.productId.location?.coordinates?.[1] ?? 11.0168
    };

    const dist = haversineDistance({ lat: centerLat, lng: centerLng }, coords);
    if (dist > maxRadius) continue;

    const isCurrentWeek = ord.createdAt >= sevenDaysAgo;
    const qty = ord.reservedQuantity || 0;

    if (isCurrentWeek) {
      current7DaysRequestedQty += qty;
      if (['COMPLETED', 'COMPLETED_PARTIAL'].includes(ord.status)) {
        current7DaysCompletedQty += (ord.fulfilledQuantity || qty);
      }
    } else {
      previous7DaysRequestedQty += qty;
    }
  }

  for (const req of requests) {
    if (!req.productId) continue;
    if (category && category !== 'ALL' && req.productId.category !== category.toUpperCase()) continue;

    const coords = {
      lng: req.productId.location?.coordinates?.[0] ?? 76.9558,
      lat: req.productId.location?.coordinates?.[1] ?? 11.0168
    };

    const dist = haversineDistance({ lat: centerLat, lng: centerLng }, coords);
    if (dist > maxRadius) continue;

    if (req.createdAt >= sevenDaysAgo) {
      current7DaysRequestCount++;
    } else {
      previous7DaysRequestCount++;
    }
  }

  // Calculate velocity and trend based on actual requested volume
  let growthPercent = 0;
  if (previous7DaysRequestedQty === 0 && previous7DaysRequestCount === 0) {
    growthPercent = (current7DaysRequestedQty > 0 || current7DaysRequestCount > 0) ? 100 : 0;
  } else {
    const prevBase = previous7DaysRequestedQty || previous7DaysRequestCount || 1;
    const currBase = current7DaysRequestedQty || current7DaysRequestCount || 0;
    growthPercent = parseFloat((((currBase - prevBase) / prevBase) * 100).toFixed(1));
  }

  let trend = DEMAND_TRENDS.STABLE;
  if (growthPercent > 15) {
    trend = DEMAND_TRENDS.INCREASING;
  } else if (growthPercent < -15) {
    trend = DEMAND_TRENDS.DECREASING;
  }

  return {
    category: category || 'ALL',
    radiusKm: maxRadius,
    requestedQuantity7Days: parseFloat(current7DaysRequestedQty.toFixed(1)),
    completedQuantity7Days: parseFloat(current7DaysCompletedQty.toFixed(1)),
    previous7DaysRequestedQty: parseFloat(previous7DaysRequestedQty.toFixed(1)),
    current7DaysRequests: current7DaysRequestCount,
    previous7DaysRequests: previous7DaysRequestCount,
    growthPercent,
    trendSignal: trend,
    telemetryWindow: 'Rolling 7-day comparison',
    disclaimer: 'Based strictly on internal Uzhavan 360 marketplace transaction telemetry. Not a speculative external market forecast.'
  };
}

/**
 * Farmer Harvest Decision Support
 * Provides data-backed decision support comparing listed stock vs actual nearby demand
 * Strictly avoids speculative claims or financial promises
 */
export async function getHarvestDecisionSupport(farmerId, { lat, lng, radiusKm = 30 } = {}) {
  const centerLat = parseFloat(lat ?? 11.0168);
  const centerLng = parseFloat(lng ?? 76.9558);
  const maxRadius = parseFloat(radiusKm);

  // 1. Fetch farmer's active produce listings
  const farmerProducts = await Product.find({
    farmerId,
    isAvailable: true,
    isDeleted: false
  });

  if (farmerProducts.length === 0) {
    return {
      farmerId,
      insights: [],
      message: 'No active produce listings found for your farm profile.'
    };
  }

  const insights = [];

  for (const product of farmerProducts) {
    // Query actual demand signals for this product's category within radius
    const demand = await getCommodityDemandSignals({
      category: product.category,
      lat: centerLat,
      lng: centerLng,
      radiusKm: maxRadius
    });

    const requestedQty = demand.requestedQuantity7Days;
    const availableQty = product.availableStock || 0;

    let guidance = '';
    let demandLevel = 'BALANCED';

    if (requestedQty > availableQty * 1.2) {
      demandLevel = 'HIGH_DEMAND';
      guidance = `Nearby demand is strong (${requestedQty} kg requested vs ${availableQty} ${product.unit} listed). Favorable window to harvest and list fresh batches.`;
    } else if (availableQty > 0 && requestedQty < availableQty * 0.5) {
      demandLevel = 'AMPLE_SUPPLY';
      guidance = `Sufficient inventory currently listed (${availableQty} ${product.unit}). Monitor freshness and ensure competitive farmgate pricing.`;
    } else {
      guidance = `Supply and regional request velocity are balanced. Maintain regular harvesting schedules.`;
    }

    insights.push({
      productId: product._id,
      productName: product.name,
      category: product.category,
      availableStock: availableQty,
      unit: product.unit,
      pricePerUnit: product.pricePerUnit,
      nearby7DaysRequestedQty: requestedQty,
      nearby7DaysCompletedQty: demand.completedQuantity7Days,
      trend: demand.trendSignal,
      demandLevel,
      explanation: `Nearby buyers requested approximately ${requestedQty} kg of ${product.name} during the last 7 days. Your currently listed quantity is ${availableQty} ${product.unit}.`,
      guidance,
      disclaimer: 'Decision support is based strictly on actual platform order history. This is not a financial promise or guaranteed sale.'
    });
  }

  return {
    farmerId,
    insights,
    generatedAt: new Date()
  };
}

/**
 * Flagship "Sell My Harvest" & Demand Matching Algorithm
 * Matches buyer demand with nearby farmer supply based on product, location, quantity, and freshness
 */
export async function matchFarmerHarvestOpportunities(farmerId, { lat, lng, radiusKm = 30 } = {}) {
  return getHarvestDecisionSupport(farmerId, { lat, lng, radiusKm });
}

/**
 * Buyer Demand ↕ Farmer Supply Matching
 * Matches buyer search/request criteria with explainable farmer produce listings
 */
export async function matchBuyerDemandWithSupply({
  category,
  productName,
  requiredQuantity = 0,
  lat,
  lng,
  radiusKm = 30
} = {}) {
  const buyerLat = parseFloat(lat ?? 11.0168);
  const buyerLng = parseFloat(lng ?? 76.9558);
  const maxRadius = parseFloat(radiusKm);

  const query = {
    isAvailable: true,
    isDeleted: false,
    availableStock: { $gt: 0 }
  };

  if (category && category !== 'ALL') {
    query.category = category.toUpperCase();
  }

  if (productName) {
    query.name = { $regex: productName, $options: 'i' };
  }

  const products = await Product.find(query)
    .populate('farmerId', 'name isVerified farmDetails')
    .lean();

  const buyerPoint = { lat: buyerLat, lng: buyerLng };

  const matches = products
    .map((p) => {
      const coords = {
        lng: p.location?.coordinates?.[0] ?? 76.9558,
        lat: p.location?.coordinates?.[1] ?? 11.0168
      };

      const distanceKm = haversineDistance(buyerPoint, coords);
      const harvestMs = new Date(p.harvestDate).getTime();
      const daysAgo = Math.max(0, Math.floor((Date.now() - harvestMs) / (1000 * 60 * 60 * 24)));

      const canFulfillFully = requiredQuantity > 0 ? p.availableStock >= requiredQuantity : true;
      const explanation = `${p.name} — ${p.availableStock} ${p.unit} available. Estimated distance: ${distanceKm.toFixed(1)} km. Harvested: ${daysAgo === 0 ? 'today' : `${daysAgo} day(s) ago`}.`;

      return {
        productId: p._id,
        name: p.name,
        category: p.category,
        availableStock: p.availableStock,
        unit: p.unit,
        pricePerUnit: p.pricePerUnit,
        farmer: {
          name: p.farmerId?.name || 'Local Farmer',
          farmName: p.farmerId?.farmDetails?.farmName,
          isVerified: Boolean(p.farmerId?.isVerified)
        },
        distanceKm: parseFloat(distanceKm.toFixed(1)),
        harvestDate: p.harvestDate,
        daysAgo,
        canFulfillFully,
        explanation
      };
    })
    .filter((m) => m.distanceKm <= maxRadius)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    criteria: { category, productName, requiredQuantity, radiusKm: maxRadius },
    totalMatches: matches.length,
    matches
  };
}
