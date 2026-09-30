import { Order } from './order.model.js';
import { BuyerRequest } from '../requests/request.model.js';
import { Product } from '../products/product.model.js';
import { User } from '../auth/user.model.js';
import { ORDER_STATES, REQUEST_STATES } from '@uzhavan360/shared';
import * as inventoryService from '../inventory/inventory.service.js';
import { sendNotification } from '../notifications/notifications.service.js';
import { AppError } from '../../middlewares/errorHandler.js';

/**
 * Phase 2: Buyer confirms quantity, initiating atomic inventory reservation
 */
export async function confirmQuantityAndReserve({ requestId, buyerId, quantity, idempotencyKey, notes }) {
  const reqQty = parseFloat(quantity);
  if (!reqQty || reqQty <= 0) {
    throw new AppError('Quantity must be greater than zero.', 400);
  }

  // Idempotency check: if key already exists, return existing order
  if (idempotencyKey) {
    const existingOrder = await Order.findOne({ idempotencyKey });
    if (existingOrder) {
      return existingOrder;
    }
  }

  const request = await BuyerRequest.findById(requestId);
  if (!request) {
    throw new AppError('Request not found.', 404);
  }

  if (request.buyerId.toString() !== buyerId.toString()) {
    throw new AppError('Unauthorized: You can only confirm quantity for your own requests.', 403);
  }

  if (request.status !== REQUEST_STATES.ACCEPTED) {
    throw new AppError(
      `Cannot confirm quantity: Request must be in ACCEPTED state. Current state: "${request.status}".`,
      400
    );
  }

  const product = await Product.findById(request.productId);
  if (!product || product.isDeleted) {
    throw new AppError('Product is no longer available.', 404);
  }

  if (product.availableStock < reqQty) {
    throw new AppError(
      `Insufficient available stock. You requested ${reqQty} ${product.unit}, but only ${product.availableStock} ${product.unit} is available.`,
      409
    );
  }

  // Fetch farmer to retrieve exact pickup farmgate coordinates
  const farmer = await User.findById(request.farmerId);

  const totalAmount = parseFloat((reqQty * product.pricePerUnit).toFixed(2));

  // 1. Create order record in RESERVED status
  const order = await Order.create({
    requestId: request._id,
    buyerId,
    farmerId: request.farmerId,
    productId: product._id,
    reservedQuantity: reqQty,
    unit: product.unit,
    unitPrice: product.pricePerUnit,
    totalAmount,
    status: ORDER_STATES.RESERVED,
    pickupLocation: {
      type: 'Point',
      coordinates: product.location.coordinates,
      address: product.address || farmer?.farmDetails?.address || {}
    },
    reservationExpiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12h TTL
    idempotencyKey: idempotencyKey || null,
    notes
  });

  // 2. Atomically reserve inventory and write ledger entry
  await inventoryService.reserveStock({
    productId: product._id,
    farmerId: request.farmerId,
    quantity: reqQty,
    orderId: order._id
  });

  // 3. Transition request to RESERVED
  request.status = REQUEST_STATES.RESERVED;
  await request.save();

  // 4. Notifications
  await sendNotification({
    recipientId: request.farmerId,
    type: 'ORDER_RESERVED',
    title: 'Produce Quantity Reserved',
    message: `Buyer confirmed ${reqQty} ${product.unit} of "${product.name}". Total: ₹${totalAmount}. Order is now RESERVED.`,
    data: { orderId: order._id, productId: product._id }
  });

  await sendNotification({
    recipientId: buyerId,
    type: 'ORDER_RESERVED',
    title: 'Order Confirmed & Stock Reserved',
    message: `Successfully reserved ${reqQty} ${product.unit} of "${product.name}". Farmgate pickup coordinates are now available.`,
    data: { orderId: order._id }
  });

  return order;
}

/**
 * Farmer updates order preparation status (PREPARING, READY_FOR_PICKUP)
 */
export async function updateOrderStatus(orderId, farmerId, newStatus) {
  const allowedTransitions = {
    [ORDER_STATES.RESERVED]: [ORDER_STATES.PREPARING],
    [ORDER_STATES.PREPARING]: [ORDER_STATES.READY_FOR_PICKUP]
  };

  const order = await Order.findById(orderId).populate('productId', 'name unit');
  if (!order) {
    throw new AppError('Order not found.', 404);
  }

  if (order.farmerId.toString() !== farmerId.toString()) {
    throw new AppError('Unauthorized: You can only update your own orders.', 403);
  }

  const validNextStates = allowedTransitions[order.status] || [];
  if (!validNextStates.includes(newStatus)) {
    throw new AppError(
      `Invalid transition: Cannot move order from "${order.status}" to "${newStatus}".`,
      400
    );
  }

  order.status = newStatus;
  await order.save();

  // Notify buyer
  const notifType = newStatus === ORDER_STATES.READY_FOR_PICKUP ? 'ORDER_READY' : 'ORDER_PREPARING';
  const notifTitle = newStatus === ORDER_STATES.READY_FOR_PICKUP ? 'Produce Ready for Farmgate Pickup!' : 'Farmer is Preparing Your Order';
  const notifMsg =
    newStatus === ORDER_STATES.READY_FOR_PICKUP
      ? `Your order for ${order.reservedQuantity} ${order.unit} of "${order.productId?.name}" is packed and ready at the farmgate.`
      : `Farmer is harvesting and packing your order for "${order.productId?.name}".`;

  await sendNotification({
    recipientId: order.buyerId,
    type: notifType,
    title: notifTitle,
    message: notifMsg,
    data: { orderId: order._id }
  });

  return order;
}

/**
 * Complete Order
 * Unified business operation called by both manual UI and Uzhavan AI voice command!
 */
export async function completeOrder(orderId, farmerId, fulfilledQuantity) {
  const order = await Order.findById(orderId).populate('productId');
  if (!order) {
    throw new AppError('Order not found.', 404);
  }

  if (order.farmerId.toString() !== farmerId.toString()) {
    throw new AppError('Unauthorized: You can only complete your own orders.', 403);
  }

  if (![ORDER_STATES.RESERVED, ORDER_STATES.PREPARING, ORDER_STATES.READY_FOR_PICKUP].includes(order.status)) {
    throw new AppError(`Cannot complete order in status "${order.status}".`, 400);
  }

  const actualFulfilled = fulfilledQuantity !== undefined ? parseFloat(fulfilledQuantity) : order.reservedQuantity;
  if (actualFulfilled <= 0 || actualFulfilled > order.reservedQuantity) {
    throw new AppError(
      `Fulfilled quantity must be between 0 and reserved quantity (${order.reservedQuantity} ${order.unit}).`,
      400
    );
  }

  // 1. Confirm sale in inventory ledger & release unfulfilled remainder if partial
  await inventoryService.confirmSale({
    productId: order.productId._id,
    farmerId,
    reservedQuantity: order.reservedQuantity,
    fulfilledQuantity: actualFulfilled,
    orderId: order._id
  });

  // 2. Update order state
  const isPartial = actualFulfilled < order.reservedQuantity;
  order.status = isPartial ? ORDER_STATES.COMPLETED_PARTIAL : ORDER_STATES.COMPLETED;
  order.fulfilledQuantity = actualFulfilled;
  order.totalAmount = parseFloat((actualFulfilled * order.unitPrice).toFixed(2));
  order.completedAt = new Date();
  await order.save();

  // 3. Notify buyer
  await sendNotification({
    recipientId: order.buyerId,
    type: 'ORDER_COMPLETED',
    title: 'Order Completed & Handed Over',
    message: `Your purchase of ${actualFulfilled} ${order.unit} "${order.productId?.name}" is completed. Thank you for supporting regional farmers!`,
    data: { orderId: order._id, totalAmount: order.totalAmount }
  });

  return order;
}

/**
 * Buyer No-Show Handling
 * Unified business operation called by UI and Uzhavan AI ("Buyer Arun didn't come")
 */
export async function markBuyerNoShow(orderId, farmerId) {
  const order = await Order.findById(orderId).populate('productId');
  if (!order) {
    throw new AppError('Order not found.', 404);
  }

  if (order.farmerId.toString() !== farmerId.toString()) {
    throw new AppError('Unauthorized: You can only resolve your own orders.', 403);
  }

  if (![ORDER_STATES.RESERVED, ORDER_STATES.READY_FOR_PICKUP].includes(order.status)) {
    throw new AppError(`Cannot mark no-show for order in status "${order.status}".`, 400);
  }

  // 1. Atomically release reserved stock back to available stock
  await inventoryService.releaseReservation({
    productId: order.productId._id,
    farmerId,
    quantity: order.reservedQuantity,
    orderId: order._id,
    reason: 'Buyer No-Show: Reserved stock restored to open market'
  });

  // 2. Transition order state
  order.status = ORDER_STATES.NO_SHOW;
  await order.save();

  // 3. Increment buyer no-show count
  await User.findByIdAndUpdate(order.buyerId, {
    $inc: { 'buyerDetails.noShowCount': 1 }
  });

  // 4. Notify buyer
  await sendNotification({
    recipientId: order.buyerId,
    type: 'ORDER_NO_SHOW',
    title: 'Order Marked as No-Show',
    message: `Your pickup window for "${order.productId?.name}" expired without collection. The reserved produce has been returned to the marketplace.`,
    data: { orderId: order._id }
  });

  return order;
}

/**
 * Buyer cancels order prior to preparation
 */
export async function cancelOrderByBuyer(orderId, buyerId, reason) {
  const order = await Order.findById(orderId).populate('productId');
  if (!order) {
    throw new AppError('Order not found.', 404);
  }

  if (order.buyerId.toString() !== buyerId.toString()) {
    throw new AppError('Unauthorized: You can only cancel your own orders.', 403);
  }

  // Can only cancel before farmer starts preparing
  if (order.status !== ORDER_STATES.RESERVED) {
    throw new AppError(
      `Cannot cancel order: Order is already in "${order.status}" state. Cancellation is only allowed while RESERVED.`,
      400
    );
  }

  // Release reservation back to available stock
  await inventoryService.releaseReservation({
    productId: order.productId._id,
    farmerId: order.farmerId,
    quantity: order.reservedQuantity,
    orderId: order._id,
    reason: `Cancelled by buyer: ${reason || 'Buyer requested cancellation'}`
  });

  order.status = ORDER_STATES.CANCELLED_BY_BUYER;
  order.cancellationReason = reason || 'Cancelled by buyer';
  await order.save();

  // Notify farmer
  await sendNotification({
    recipientId: order.farmerId,
    type: 'ORDER_CANCELLED',
    title: 'Order Cancelled by Buyer',
    message: `Buyer cancelled order for ${order.reservedQuantity} ${order.unit} "${order.productId?.name}". Stock has been restored to your available inventory.`,
    data: { orderId: order._id }
  });

  return order;
}

/**
 * Farmer cancels order due to crop disruption
 */
export async function cancelOrderByFarmer(orderId, farmerId, reason) {
  if (!reason || reason.trim().length < 5) {
    throw new AppError('A valid operational reason is required for farmer cancellation.', 400);
  }

  const order = await Order.findById(orderId).populate('productId');
  if (!order) {
    throw new AppError('Order not found.', 404);
  }

  if (order.farmerId.toString() !== farmerId.toString()) {
    throw new AppError('Unauthorized: You can only cancel your own orders.', 403);
  }

  if ([ORDER_STATES.COMPLETED, ORDER_STATES.COMPLETED_PARTIAL, ORDER_STATES.NO_SHOW].includes(order.status)) {
    throw new AppError(`Cannot cancel finalized order in status "${order.status}".`, 400);
  }

  // Release reservation back to available stock
  await inventoryService.releaseReservation({
    productId: order.productId._id,
    farmerId,
    quantity: order.reservedQuantity,
    orderId: order._id,
    reason: `Cancelled by farmer: ${reason}`
  });

  order.status = ORDER_STATES.CANCELLED_BY_FARMER;
  order.cancellationReason = reason;
  await order.save();

  // Notify buyer
  await sendNotification({
    recipientId: order.buyerId,
    type: 'ORDER_CANCELLED',
    title: 'Order Cancelled by Farmer',
    message: `Farmer had to cancel your order for "${order.productId?.name}": ${reason}. Please explore nearby alternative farmers.`,
    data: { orderId: order._id }
  });

  return order;
}

/**
 * Get paginated orders for user
 */
export async function getOrders(userId, role, { status, page = 1, limit = 20 } = {}) {
  const query = role === 'ROLE_FARMER' ? { farmerId: userId } : { buyerId: userId };
  if (status) {
    query.status = status;
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = Math.min(50, Math.max(1, parseInt(limit, 10)));

  const [items, total] = await Promise.all([
    Order.find(query)
      .populate('productId', 'name category pricePerUnit unit images')
      .populate('buyerId', 'name phone buyerDetails')
      .populate('farmerId', 'name phone isVerified farmDetails')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(take),
    Order.countDocuments(query)
  ]);

  return {
    items,
    pagination: {
      page: parseInt(page, 10),
      limit: take,
      total,
      pages: Math.ceil(total / take)
    }
  };
}

/**
 * Get single order details with ownership verification
 */
export async function getOrderById(orderId, userId) {
  const order = await Order.findById(orderId)
    .populate('productId')
    .populate('buyerId', 'name phone buyerDetails')
    .populate('farmerId', 'name phone isVerified farmDetails');

  if (!order) {
    throw new AppError('Order not found.', 404);
  }

  const isParty =
    order.buyerId._id.toString() === userId.toString() ||
    order.farmerId._id.toString() === userId.toString();

  if (!isParty) {
    throw new AppError('Unauthorized: You can only view orders you are party to.', 403);
  }

  return order;
}

/**
 * Automatically expire orders whose reservation TTL window has passed.
 * Atomically releases reserved stock back to available stock in inventory ledger.
 */
export async function checkAndExpireReservations() {
  const now = new Date();
  const expiredOrders = await Order.find({
    status: ORDER_STATES.RESERVED,
    reservationExpiresAt: { $lt: now }
  }).populate('productId');

  const results = [];
  for (const order of expiredOrders) {
    try {
      const prodId = order.productId?._id || order.productId;
      const farmerId = order.farmerId?._id || order.farmerId;

      // 1. Release reserved stock back to available stock
      await inventoryService.releaseReservation({
        productId: prodId,
        farmerId,
        quantity: order.reservedQuantity,
        orderId: order._id,
        reason: 'Automated Reservation TTL Expiry: Stock restored to marketplace'
      });

      // 2. Mark order as EXPIRED
      order.status = ORDER_STATES.EXPIRED;
      await order.save();

      // 3. Notify buyer and farmer
      await sendNotification({
        recipientId: order.buyerId?._id || order.buyerId,
        type: 'ORDER_EXPIRED',
        title: 'Reservation Expired',
        message: `Your reservation for "${order.productId?.name || 'produce'}" has expired after 12 hours. Produce has returned to open market.`,
        data: { orderId: order._id }
      });

      await sendNotification({
        recipientId: farmerId,
        type: 'ORDER_EXPIRED',
        title: 'Reservation Restored to Open Stock',
        message: `Reservation for ${order.reservedQuantity} ${order.unit} expired. Stock has been returned to your available inventory.`,
        data: { orderId: order._id }
      });

      results.push({ orderId: order._id, status: ORDER_STATES.EXPIRED });
    } catch (err) {
      console.error(`[EXPIRY WORKER] Failed to expire order ${order._id}:`, err.message);
    }
  }

  return results;
}

