import { HarvestByproduct } from './byproduct.model.js';
import { haversineDistance, DEFAULT_DISCOVERY_RADIUS_KM } from '../../utils/location.js';
import { AppError } from '../../middlewares/errorHandler.js';

// Informational potential industry applications based on byproduct type
const POTENTIAL_USE_MAP = {
  PADDY_STRAW: ['Mushroom Bedding', 'Livestock Feed', 'Biomass Pellets', 'Mulching & Soil Cover'],
  WHEAT_STRAW: ['Livestock Fodder', 'Bio-Plastics', 'Packaging Material', 'Straw Bale Construction'],
  SUGARCANE_BAGASSE: ['Bio-Energy / Cogeneration', 'Pulp & Paper', 'Compost Substrate', 'Disposable Tableware'],
  CORN_STALKS: ['Ruminant Roughage', 'Particleboard', 'Bio-Gas Digestion', 'Erosion Control'],
  BANANA_STEMS: ['Natural Fiber Extraction', 'Artisanal Paper', 'Liquid Organic Bio-Fertilizer', 'Handicrafts'],
  COCONUT_SHELLS: ['Activated Carbon', 'Cocopeat Soil Conditioning', 'Fuel Briquettes', 'Crafts'],
  FARM_MANURE: ['Organic Compost Enrichment', 'Bio-Gas Digesters', 'Vermicomposting Substrate'],
  CROP_RESIDUE: ['Bio-Char Production', 'Soil Organic Matter Mulch', 'Composting'],
  FRUIT_RESIDUES: ['Citrus Oil Extraction', 'Pectin Production', 'Organic Composting', 'Bio-Enzymes'],
  VEGETABLE_RESIDUES: ['Vermicompost Feeding', 'Silage Production', 'Biomass Slurry', 'Green Manure'],
  OTHER: ['Composting', 'Biomass Energy']
};

/**
 * Create a new harvest byproduct listing
 */
export async function createByproductListing(farmerId, byproductData) {
  const {
    name,
    category,
    quantity,
    unit,
    expectedPrice,
    latitude,
    longitude,
    address,
    availableFrom,
    moistureLevel,
    packagingType,
    description,
    images
  } = byproductData;

  const initialQty = parseFloat(quantity);
  if (!initialQty || initialQty <= 0) {
    throw new AppError('Quantity must be greater than zero.', 400);
  }

  const coordinates = [
    parseFloat(longitude ?? 76.9558),
    parseFloat(latitude ?? 11.0168)
  ];

  const catKey = (category || 'OTHER').toUpperCase();
  const defaultUses = POTENTIAL_USE_MAP[catKey] || POTENTIAL_USE_MAP.OTHER;

  const byproduct = await HarvestByproduct.create({
    farmerId,
    name,
    category: catKey,
    quantity: initialQty,
    unit: unit || 'TON',
    expectedPrice: parseFloat(expectedPrice || 0),
    location: {
      type: 'Point',
      coordinates
    },
    address: address || {},
    availableFrom: availableFrom ? new Date(availableFrom) : new Date(),
    moistureLevel: moistureLevel || 'UNSPECIFIED',
    packagingType: packagingType || 'LOOSE',
    potentialUses: byproductData.potentialUses?.length ? byproductData.potentialUses : defaultUses,
    description,
    images: images || [],
    status: 'AVAILABLE'
  });

  return byproduct;
}

/**
 * Discover byproducts nearby
 */
export async function searchByproducts({
  lat,
  lng,
  radius = DEFAULT_DISCOVERY_RADIUS_KM,
  category,
  search,
  minPrice,
  maxPrice,
  page = 1,
  limit = 20
} = {}) {
  const searchLat = parseFloat(lat ?? 11.0168);
  const searchLng = parseFloat(lng ?? 76.9558);
  const maxRadiusKm = parseFloat(radius);

  const query = { status: 'AVAILABLE' };
  if (category && category !== 'ALL') {
    query.category = category.toUpperCase();
  }

  if (search && typeof search === 'string') {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped) {
      query.name = { $regex: escaped, $options: 'i' };
    }
  }

  if (minPrice || maxPrice) {
    query.expectedPrice = {};
    if (minPrice) query.expectedPrice.$gte = parseFloat(minPrice);
    if (maxPrice) query.expectedPrice.$lte = parseFloat(maxPrice);
  }

  const items = await HarvestByproduct.find(query)
    .populate('farmerId', 'name phone isVerified farmDetails')
    .lean();

  const buyerPoint = { lat: searchLat, lng: searchLng };

  const enriched = items
    .map((item) => {
      const coords = {
        lng: item.location?.coordinates?.[0] ?? 76.9558,
        lat: item.location?.coordinates?.[1] ?? 11.0168
      };
      const distanceKm = haversineDistance(buyerPoint, coords);
      return {
        ...item,
        distanceKm: parseFloat(distanceKm.toFixed(1))
      };
    })
    .filter((item) => item.distanceKm <= maxRadiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const take = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const pageNum = Math.max(1, parseInt(page, 10));
  const total = enriched.length;
  const paginated = enriched.slice((pageNum - 1) * take, pageNum * take);

  return {
    items: paginated,
    pagination: {
      page: pageNum,
      limit: take,
      total,
      pages: Math.ceil(total / take)
    }
  };
}

/**
 * Get farmer's own byproduct listings
 */
export async function getFarmerByproducts(farmerId) {
  return HarvestByproduct.find({ farmerId }).sort({ createdAt: -1 });
}

/**
 * Delete a byproduct listing
 */
export async function deleteByproduct(byproductId, farmerId) {
  const item = await HarvestByproduct.findById(byproductId);
  if (!item) {
    throw new AppError('Byproduct listing not found.', 404);
  }

  if (item.farmerId.toString() !== farmerId.toString()) {
    throw new AppError('Unauthorized: You can only delete your own listings.', 403);
  }

  await HarvestByproduct.findByIdAndDelete(byproductId);
  return { message: 'Byproduct listing deleted successfully.' };
}
