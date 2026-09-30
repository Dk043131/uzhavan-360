import { Product } from './product.model.js';
import { InventoryLedger } from '../inventory/inventoryLedger.model.js';
import { BuyerRequest } from '../requests/request.model.js';
import { Order } from '../orders/order.model.js';
import { User } from '../auth/user.model.js';
import { INVENTORY_TRANSACTION_TYPES, REQUEST_STATES, ORDER_STATES } from '@uzhavan360/shared';
import { computeFreshnessTier, computeFreshnessScore } from '../../utils/freshness.js';
import { resolveTamilNaduLocation } from '../../utils/location.js';
import { inferCropCategory } from '../../utils/cropIntelligence.js';
import { AppError } from '../../middlewares/errorHandler.js';

/**
 * Create a new agricultural product listing
 */
export async function createProduct(farmerId, productData) {
  const {
    name,
    category,
    unit,
    pricePerUnit,
    quantity,
    harvestDate,
    latitude,
    longitude,
    locationName,
    city,
    district,
    address,
    description,
    images
  } = productData;

  const initialQty = parseFloat(quantity);
  if (!initialQty || initialQty <= 0) {
    throw new AppError('Initial quantity must be greater than zero.', 400);
  }

  const price = parseFloat(pricePerUnit);
  if (isNaN(price) || price <= 0) {
    throw new AppError('Price per unit must be greater than zero.', 400);
  }

  // Auto-resolve location coordinates from city/district if lat/lng not provided
  let resolvedLat = latitude ? parseFloat(latitude) : null;
  let resolvedLng = longitude ? parseFloat(longitude) : null;
  let resolvedAddress = address || {};

  const queryLoc = locationName || city || district || (typeof address === 'string' ? address : address?.district || address?.village);
  if ((!resolvedLat || !resolvedLng) && queryLoc) {
    const geo = resolveTamilNaduLocation(queryLoc);
    if (geo) {
      resolvedLat = geo.lat;
      resolvedLng = geo.lng;
      resolvedAddress = {
        district: geo.district,
        city: geo.city,
        state: 'Tamil Nadu',
        ...(typeof address === 'object' ? address : {})
      };
    }
  }

  // Fallback to farmer profile location if available
  if (!resolvedLat || !resolvedLng) {
    try {
      const farmer = await User.findById(farmerId).lean();
      if (farmer?.farmDetails?.location?.coordinates?.length === 2) {
        resolvedLng = farmer.farmDetails.location.coordinates[0];
        resolvedLat = farmer.farmDetails.location.coordinates[1];
        if (farmer.farmDetails.address) {
          resolvedAddress = { ...farmer.farmDetails.address, ...resolvedAddress };
        }
      }
    } catch (_) {}
  }

  const coordinates = [
    parseFloat(resolvedLng ?? 76.9558),
    parseFloat(resolvedLat ?? 11.0168)
  ];

  // Auto-infer category if not provided
  const resolvedCategory = category && category !== 'OTHER'
    ? category
    : inferCropCategory(name);

  // Parse harvest date
  let parsedHarvestDate = new Date();
  if (typeof harvestDate === 'string') {
    const lowerDate = harvestDate.toLowerCase().trim();
    if (lowerDate === 'tomorrow' || lowerDate === 'நாளை') {
      parsedHarvestDate = new Date(Date.now() + 86400000);
    } else if (lowerDate === 'day after tomorrow' || lowerDate === 'நாளை மறுநாள்') {
      parsedHarvestDate = new Date(Date.now() + 2 * 86400000);
    } else if (lowerDate === 'yesterday' || lowerDate === 'நேற்று') {
      parsedHarvestDate = new Date(Date.now() - 86400000);
    } else if (lowerDate !== 'today' && lowerDate !== 'இன்று') {
      const parsed = new Date(harvestDate);
      if (!isNaN(parsed.getTime())) parsedHarvestDate = parsed;
    }
  } else if (harvestDate instanceof Date) {
    parsedHarvestDate = harvestDate;
  }

  const product = await Product.create({
    farmerId,
    name: name || 'Fresh Farm Produce',
    category: resolvedCategory,
    unit: unit || 'KG',
    pricePerUnit: price,
    totalStock: initialQty,
    availableStock: initialQty,
    reservedStock: 0,
    soldStock: 0,
    harvestDate: parsedHarvestDate,
    location: {
      type: 'Point',
      coordinates
    },
    address: resolvedAddress,
    description: description || `Fresh ${name || 'produce'} from local farm`,
    images: images || [],
    isAvailable: true
  });

  // Record initial inventory listing in ledger
  await InventoryLedger.create({
    productId: product._id,
    farmerId,
    transactionType: INVENTORY_TRANSACTION_TYPES.INITIAL_LISTING,
    quantityDelta: initialQty,
    totalBefore: 0,
    totalAfter: initialQty,
    availableBefore: 0,
    availableAfter: initialQty,
    reservedBefore: 0,
    reservedAfter: 0,
    soldBefore: 0,
    soldAfter: 0,
    reason: 'Initial harvest produce listing'
  });

  return product;
}

/**
 * Get product by ID with computed freshness tier
 */
export async function getProductById(productId) {
  const product = await Product.findOne({ _id: productId, isDeleted: false }).populate(
    'farmerId',
    'name phone isVerified farmDetails'
  );

  if (!product) {
    throw new AppError('Product listing not found.', 404);
  }

  const productObj = product.toObject();
  productObj.freshnessTier = computeFreshnessTier(product.harvestDate, product.category);
  productObj.freshnessScore = computeFreshnessScore(product.harvestDate, product.category);

  return productObj;
}

/**
 * Get all active products for a specific farmer
 */
export async function getFarmerProducts(farmerId) {
  const products = await Product.find({ farmerId, isDeleted: false }).sort({ createdAt: -1 });
  return products.map((p) => {
    const pObj = p.toObject();
    pObj.freshnessTier = computeFreshnessTier(p.harvestDate, p.category);
    pObj.freshnessScore = computeFreshnessScore(p.harvestDate, p.category);
    return pObj;
  });
}

/**
 * Update an existing product
 */
export async function updateProduct(productId, farmerId, updateData) {
  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) {
    throw new AppError('Product not found.', 404);
  }

  if (product.farmerId.toString() !== farmerId.toString()) {
    throw new AppError('Unauthorized: You can only edit your own products.', 403);
  }

  // Allowed editable fields
  const allowedUpdates = ['name', 'pricePerUnit', 'description', 'images', 'isAvailable'];
  for (const key of allowedUpdates) {
    if (updateData[key] !== undefined) {
      product[key] = updateData[key];
    }
  }

  await product.save();
  return product;
}

/**
 * Delete a product with active reservation and request protection
 * Level 1 Architecture Reference: Section 23 Rule 19
 */
export async function deleteProduct(productId, farmerId) {
  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) {
    throw new AppError('Product not found.', 404);
  }

  if (product.farmerId.toString() !== farmerId.toString()) {
    throw new AppError('Unauthorized: You can only delete your own products.', 403);
  }

  // 1. Check if there are active reserved stocks
  if (product.reservedStock > 0) {
    throw new AppError(
      `Cannot delete product: There are currently ${product.reservedStock} ${product.unit} locked in active buyer reservations. Please resolve orders before deletion.`,
      400
    );
  }

  // 2. Check for active pending requests
  const activeRequests = await BuyerRequest.countDocuments({
    productId,
    status: { $in: [REQUEST_STATES.REQUESTED, REQUEST_STATES.ACCEPTED, REQUEST_STATES.QUANTITY_PENDING] }
  });

  if (activeRequests > 0) {
    throw new AppError(
      `Cannot delete product: There are ${activeRequests} pending buyer requests awaiting response or quantity confirmation.`,
      400
    );
  }

  // 3. Check for active unfulfilled orders
  const activeOrders = await Order.countDocuments({
    productId,
    status: { $in: [ORDER_STATES.RESERVED, ORDER_STATES.PREPARING, ORDER_STATES.READY_FOR_PICKUP] }
  });

  if (activeOrders > 0) {
    throw new AppError(
      `Cannot delete product: There are ${activeOrders} active orders being prepared or awaiting pickup.`,
      400
    );
  }

  // Safe to soft-delete
  product.isDeleted = true;
  product.isAvailable = false;
  await product.save();

  return { message: 'Product successfully deleted.' };
}
