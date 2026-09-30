import { Product } from '../products/product.model.js';
import { haversineDistance, applyPrivacyJitter, DEFAULT_DISCOVERY_RADIUS_KM } from '../../utils/location.js';
import { computeFreshnessTier, computeFreshnessScore, computeFreshnessDetails } from '../../utils/freshness.js';
import { computeDeterministicRank } from './ranking.service.js';

/**
 * Hyper-local marketplace discovery search
 * Combines geospatial filtering, deterministic ranking, and privacy jitter
 */
export async function searchMarketplace({
  lat,
  lng,
  radius = DEFAULT_DISCOVERY_RADIUS_KM,
  category,
  search,
  minPrice,
  maxPrice,
  freshnessTier,
  onlyVerified = false,
  availableOnly = true,
  sortBy = 'recommended', // 'recommended' | 'distance' | 'price_asc' | 'price_desc' | 'freshness' | 'urgency'
  page = 1,
  limit = 20
} = {}) {
  const buyerLat = parseFloat(lat ?? 11.0168);
  const buyerLng = parseFloat(lng ?? 76.9558);
  const maxRadiusKm = parseFloat(radius);

  // Construct MongoDB filter
  const filter = {
    isAvailable: true,
    isDeleted: false
  };

  if (availableOnly === 'true' || availableOnly === true) {
    filter.availableStock = { $gt: 0 };
  }

  if (category && category !== 'ALL') {
    filter.category = category.toUpperCase();
  }

  if (search && typeof search === 'string') {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped) {
      filter.name = { $regex: escaped, $options: 'i' };
    }
  }

  if (minPrice || maxPrice) {
    filter.pricePerUnit = {};
    if (minPrice) filter.pricePerUnit.$gte = parseFloat(minPrice);
    if (maxPrice) filter.pricePerUnit.$lte = parseFloat(maxPrice);
  }

  // Fetch available candidate products
  const products = await Product.find(filter)
    .populate('farmerId', 'name phone isVerified farmDetails')
    .lean();

  const buyerPoint = { lat: buyerLat, lng: buyerLng };

  // Calculate category average price if applicable
  const validPrices = products.map((p) => p.pricePerUnit).filter((pr) => typeof pr === 'number' && pr > 0);
  const categoryAvgPrice = validPrices.length > 0 ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : null;

  // Calculate distance, freshness, deterministic ranking, and apply privacy jitter
  let enriched = products
    .map((p) => {
      const farmer = p.farmerId || {};
      const exactCoords = {
        lng: p.location?.coordinates?.[0] ?? 76.9558,
        lat: p.location?.coordinates?.[1] ?? 11.0168
      };

      const distanceKm = haversineDistance(buyerPoint, exactCoords);
      const computedTier = computeFreshnessTier(p.harvestDate, p.category);
      const freshnessScore = computeFreshnessScore(p.harvestDate, p.category);
      const freshnessDetails = computeFreshnessDetails(p.harvestDate, p.category);

      // Level 1 ADR 05: Public discovery privacy fuzzing (500m - 1000m random spatial jitter)
      const fuzzedLocation = applyPrivacyJitter(exactCoords, 800);

      // Deterministic Multi-Factor Ranking
      const { score: compositeScore, breakdown } = computeDeterministicRank(p, {
        distanceKm,
        maxRadiusKm,
        freshnessScore,
        isVerifiedFarmer: Boolean(farmer.isVerified),
        categoryAvgPrice
      });

      // Stock status badge
      const availabilityStatus = p.availableStock > 0 ? (p.availableStock >= 10 ? 'IN_STOCK' : 'LOW_STOCK') : 'OUT_OF_STOCK';

      return {
        _id: p._id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        pricePerUnit: p.pricePerUnit,
        availableStock: p.availableStock,
        totalStock: p.totalStock,
        harvestDate: p.harvestDate,
        freshnessTier: computedTier,
        freshnessScore: parseFloat(freshnessScore.toFixed(2)),
        freshnessDetails,
        availabilityStatus,
        distanceKm: parseFloat(distanceKm.toFixed(1)),
        compositeScore,
        rankingBreakdown: breakdown,
        fuzzedLocation,
        address: {
          village: p.address?.village || farmer.farmDetails?.address?.village || 'Local Village',
          district: p.address?.district || farmer.farmDetails?.address?.district || 'District'
        },
        farmer: {
          _id: farmer._id,
          name: farmer.name,
          farmName: farmer.farmDetails?.farmName || `${farmer.name}'s Farm`,
          isVerified: Boolean(farmer.isVerified)
        },
        images: p.images || []
      };
    })
    // Filter by radius
    .filter((item) => item.distanceKm <= maxRadiusKm);

  // Filter by freshness tier if requested
  if (freshnessTier && freshnessTier !== 'ALL') {
    enriched = enriched.filter((item) => item.freshnessTier === freshnessTier);
  }

  // Filter by verification if requested
  if (onlyVerified === 'true' || onlyVerified === true) {
    enriched = enriched.filter((item) => item.farmer.isVerified);
  }

  // Sorting
  switch (sortBy) {
    case 'distance':
      enriched.sort((a, b) => a.distanceKm - b.distanceKm);
      break;
    case 'price_asc':
      enriched.sort((a, b) => a.pricePerUnit - b.pricePerUnit);
      break;
    case 'price_desc':
      enriched.sort((a, b) => b.pricePerUnit - a.pricePerUnit);
      break;
    case 'freshness':
      enriched.sort((a, b) => new Date(b.harvestDate) - new Date(a.harvestDate));
      break;
    case 'urgency':
      enriched.sort((a, b) => a.freshnessScore - b.freshnessScore);
      break;
    case 'recommended':
    default:
      enriched.sort((a, b) => b.compositeScore - a.compositeScore);
      break;
  }

  // Paginate
  const take = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const pageNum = Math.max(1, parseInt(page, 10));
  const total = enriched.length;
  const paginatedItems = enriched.slice((pageNum - 1) * take, pageNum * take);

  return {
    items: paginatedItems,
    pagination: {
      page: pageNum,
      limit: take,
      total,
      pages: Math.ceil(total / take)
    }
  };
}
