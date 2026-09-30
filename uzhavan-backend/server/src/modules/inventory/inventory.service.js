import { Product } from '../products/product.model.js';
import { InventoryLedger } from './inventoryLedger.model.js';
import { INVENTORY_TRANSACTION_TYPES } from '@uzhavan360/shared';
import { AppError } from '../../middlewares/errorHandler.js';

/**
 * Atomic stock reservation.
 * Guarantees that two concurrent buyers never reserve the same stock.
 */
export async function reserveStock({ productId, farmerId, quantity, orderId, session = null }) {
  if (quantity <= 0) {
    throw new AppError('Quantity to reserve must be greater than zero.', 400);
  }

  // Atomically check availability and update counters
  const query = {
    _id: productId,
    farmerId,
    availableStock: { $gte: quantity },
    isDeleted: false
  };

  const update = {
    $inc: {
      availableStock: -quantity,
      reservedStock: quantity
    }
  };

  const opts = { new: true };
  if (session) opts.session = session;

  const productBefore = await Product.findById(productId);
  if (!productBefore) {
    throw new AppError('Product not found.', 404);
  }

  if (productBefore.availableStock < quantity) {
    throw new AppError(
      `Insufficient available stock. Requested: ${quantity} ${productBefore.unit}, Available: ${productBefore.availableStock} ${productBefore.unit}`,
      409
    );
  }

  const updatedProduct = await Product.findOneAndUpdate(query, update, opts);
  if (!updatedProduct) {
    throw new AppError(
      'Stock reservation conflict. Available quantity was claimed by another transaction.',
      409
    );
  }

  // Record immutable ledger entry
  await InventoryLedger.create(
    [
      {
        productId,
        farmerId,
        transactionType: INVENTORY_TRANSACTION_TYPES.RESERVE_STOCK,
        quantityDelta: quantity,
        totalBefore: productBefore.totalStock,
        totalAfter: updatedProduct.totalStock,
        availableBefore: productBefore.availableStock,
        availableAfter: updatedProduct.availableStock,
        reservedBefore: productBefore.reservedStock,
        reservedAfter: updatedProduct.reservedStock,
        soldBefore: productBefore.soldStock,
        soldAfter: updatedProduct.soldStock,
        referenceId: orderId?.toString() || null,
        reason: 'Buyer quantity confirmed; stock atomically reserved'
      }
    ],
    session ? { session } : {}
  );

  return updatedProduct;
}

/**
 * Release reserved stock back to available stock.
 * Handles: Buyer cancellation, Farmer cancellation, Buyer No-Show, TTL Expiration.
 */
export async function releaseReservation({
  productId,
  farmerId,
  quantity,
  orderId,
  reason = 'Reservation released',
  session = null
}) {
  if (quantity <= 0) {
    throw new AppError('Quantity to release must be greater than zero.', 400);
  }

  const productBefore = await Product.findById(productId);
  if (!productBefore) {
    throw new AppError('Product not found.', 404);
  }

  // Guard: Ensure reservedStock >= quantity to prevent negative reservation counts
  const query = {
    _id: productId,
    farmerId,
    reservedStock: { $gte: quantity }
  };

  const update = {
    $inc: {
      reservedStock: -quantity,
      availableStock: quantity
    },
    $set: {
      isAvailable: true // Stock is returned, restore availability
    }
  };

  const opts = { new: true };
  if (session) opts.session = session;

  const updatedProduct = await Product.findOneAndUpdate(query, update, opts);
  if (!updatedProduct) {
    throw new AppError('Cannot release stock: reserved quantity is already released or invalid.', 409);
  }

  // Record ledger entry
  await InventoryLedger.create(
    [
      {
        productId,
        farmerId,
        transactionType: INVENTORY_TRANSACTION_TYPES.RELEASE_RESERVATION,
        quantityDelta: quantity,
        totalBefore: productBefore.totalStock,
        totalAfter: updatedProduct.totalStock,
        availableBefore: productBefore.availableStock,
        availableAfter: updatedProduct.availableStock,
        reservedBefore: productBefore.reservedStock,
        reservedAfter: updatedProduct.reservedStock,
        soldBefore: productBefore.soldStock,
        soldAfter: updatedProduct.soldStock,
        referenceId: orderId?.toString() || null,
        reason
      }
    ],
    session ? { session } : {}
  );

  return updatedProduct;
}

/**
 * Finalize sale upon order completion.
 * Supports partial fulfillment reconciliation.
 */
export async function confirmSale({
  productId,
  farmerId,
  reservedQuantity,
  fulfilledQuantity,
  orderId,
  session = null
}) {
  const actualFulfilled = fulfilledQuantity !== undefined ? fulfilledQuantity : reservedQuantity;

  if (actualFulfilled < 0 || actualFulfilled > reservedQuantity) {
    throw new AppError('Fulfilled quantity must be between 0 and reserved quantity.', 400);
  }

  const productBefore = await Product.findById(productId);
  if (!productBefore) {
    throw new AppError('Product not found.', 404);
  }

  // Unfulfilled remainder to restore to available stock
  const remainderToRestore = reservedQuantity - actualFulfilled;

  const query = {
    _id: productId,
    farmerId,
    reservedStock: { $gte: reservedQuantity }
  };

  const update = {
    $inc: {
      reservedStock: -reservedQuantity,
      soldStock: actualFulfilled,
      availableStock: remainderToRestore
    }
  };

  const opts = { new: true };
  if (session) opts.session = session;

  const updatedProduct = await Product.findOneAndUpdate(query, update, opts);
  if (!updatedProduct) {
    throw new AppError('Cannot complete sale: reserved stock has been altered or released.', 409);
  }

  // Record ledger entry
  await InventoryLedger.create(
    [
      {
        productId,
        farmerId,
        transactionType: INVENTORY_TRANSACTION_TYPES.CONFIRM_SALE,
        quantityDelta: actualFulfilled,
        totalBefore: productBefore.totalStock,
        totalAfter: updatedProduct.totalStock,
        availableBefore: productBefore.availableStock,
        availableAfter: updatedProduct.availableStock,
        reservedBefore: productBefore.reservedStock,
        reservedAfter: updatedProduct.reservedStock,
        soldBefore: productBefore.soldStock,
        soldAfter: updatedProduct.soldStock,
        referenceId: orderId?.toString() || null,
        reason:
          remainderToRestore > 0
            ? `Order completed with partial fulfillment (${actualFulfilled} sold, ${remainderToRestore} returned to available)`
            : 'Order completed; reserved stock converted to sold'
      }
    ],
    session ? { session } : {}
  );

  return updatedProduct;
}

/**
 * Record an off-platform/offline farmgate cash sale.
 * Farmer sells produce directly at farmgate or local village sandhai.
 */
export async function recordOffPlatformSale({ productId, farmerId, quantity, reason = 'Direct farmgate cash sale' }) {
  if (quantity <= 0) {
    throw new AppError('Sale quantity must be positive.', 400);
  }

  const productBefore = await Product.findById(productId);
  if (!productBefore) {
    throw new AppError('Product not found.', 404);
  }

  if (productBefore.farmerId.toString() !== farmerId.toString()) {
    throw new AppError('Unauthorized: You can only record sales for your own products.', 403);
  }

  if (productBefore.availableStock < quantity) {
    throw new AppError(
      `Cannot record offline sale: Available stock is only ${productBefore.availableStock} ${productBefore.unit}. Cannot sell ${quantity} ${productBefore.unit}.`,
      400
    );
  }

  const query = {
    _id: productId,
    farmerId,
    availableStock: { $gte: quantity }
  };

  const update = {
    $inc: {
      availableStock: -quantity,
      soldStock: quantity
    }
  };

  const updatedProduct = await Product.findOneAndUpdate(query, update, { new: true });
  if (!updatedProduct) {
    throw new AppError('Stock conflict: Available stock was modified by another transaction.', 409);
  }

  // Record ledger entry
  await InventoryLedger.create({
    productId,
    farmerId,
    transactionType: INVENTORY_TRANSACTION_TYPES.OFFLINE_SALE,
    quantityDelta: quantity,
    totalBefore: productBefore.totalStock,
    totalAfter: updatedProduct.totalStock,
    availableBefore: productBefore.availableStock,
    availableAfter: updatedProduct.availableStock,
    reservedBefore: productBefore.reservedStock,
    reservedAfter: updatedProduct.reservedStock,
    soldBefore: productBefore.soldStock,
    soldAfter: updatedProduct.soldStock,
    reason
  });

  return updatedProduct;
}

/**
 * Add newly harvested stock to an existing product batch.
 */
export async function addHarvestBatch({ productId, farmerId, quantity, reason = 'New harvest added' }) {
  if (quantity <= 0) {
    throw new AppError('Added harvest quantity must be positive.', 400);
  }

  const productBefore = await Product.findById(productId);
  if (!productBefore) {
    throw new AppError('Product not found.', 404);
  }

  if (productBefore.farmerId.toString() !== farmerId.toString()) {
    throw new AppError('Unauthorized: You can only add harvest to your own products.', 403);
  }

  const updatedProduct = await Product.findOneAndUpdate(
    { _id: productId, farmerId },
    {
      $inc: {
        totalStock: quantity,
        availableStock: quantity
      },
      $set: {
        isAvailable: true
      }
    },
    { new: true }
  );

  // Record ledger entry
  await InventoryLedger.create({
    productId,
    farmerId,
    transactionType: INVENTORY_TRANSACTION_TYPES.BATCH_ADDITION,
    quantityDelta: quantity,
    totalBefore: productBefore.totalStock,
    totalAfter: updatedProduct.totalStock,
    availableBefore: productBefore.availableStock,
    availableAfter: updatedProduct.availableStock,
    reservedBefore: productBefore.reservedStock,
    reservedAfter: updatedProduct.reservedStock,
    soldBefore: productBefore.soldStock,
    soldAfter: updatedProduct.soldStock,
    reason
  });

  return updatedProduct;
}

/**
 * Retrieve immutable inventory ledger audit trail for a product
 */
export async function getInventoryHistory(productId, farmerId) {
  const product = await Product.findById(productId);
  if (!product) {
    throw new AppError('Product not found.', 404);
  }

  if (product.farmerId.toString() !== farmerId.toString()) {
    throw new AppError('Unauthorized: You can only view ledger history for your own products.', 403);
  }

  return InventoryLedger.find({ productId }).sort({ createdAt: -1 });
}
