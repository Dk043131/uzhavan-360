import { BuyerRequest } from './request.model.js';
import { Product } from '../products/product.model.js';
import { REQUEST_STATES } from '@uzhavan360/shared';
import { sendNotification } from '../notifications/notifications.service.js';
import { AppError } from '../../middlewares/errorHandler.js';

/**
 * Phase 1: Buyer initiates a purchase request
 * Rule: Zero inventory is deducted or locked at this stage.
 */
export async function createRequest(buyerId, { productId, note }) {
  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) {
    throw new AppError('Product not found or unavailable.', 404);
  }

  if (product.farmerId.toString() === buyerId.toString()) {
    throw new AppError('You cannot send a purchase request for your own product.', 400);
  }

  if (!product.isAvailable || product.availableStock <= 0) {
    throw new AppError('This product currently has zero available stock.', 400);
  }

  // Check for duplicate pending requests from the same buyer
  const existingActive = await BuyerRequest.findOne({
    buyerId,
    productId,
    status: { $in: [REQUEST_STATES.REQUESTED, REQUEST_STATES.ACCEPTED] }
  });

  if (existingActive) {
    throw new AppError(
      'You already have an active request for this product. Please wait for the farmer response or confirm quantity.',
      409
    );
  }

  const request = await BuyerRequest.create({
    buyerId,
    farmerId: product.farmerId,
    productId,
    note,
    status: REQUEST_STATES.REQUESTED,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hour TTL
  });

  // Notify farmer
  await sendNotification({
    recipientId: product.farmerId,
    type: 'REQUEST_RECEIVED',
    title: 'New Buyer Produce Request',
    message: `A buyer requested to purchase "${product.name}". Review and accept to proceed.`,
    data: { requestId: request._id, productId: product._id }
  });

  return request;
}

/**
 * Farmer accepts incoming request
 */
export async function acceptRequest(requestId, farmerId) {
  const request = await BuyerRequest.findById(requestId).populate('productId');
  if (!request) {
    throw new AppError('Request not found.', 404);
  }

  if (request.farmerId.toString() !== farmerId.toString()) {
    throw new AppError('Unauthorized: You can only respond to requests for your own produce.', 403);
  }

  if (request.status !== REQUEST_STATES.REQUESTED) {
    throw new AppError(
      `Invalid state transition: Cannot accept a request that is currently in status "${request.status}".`,
      400
    );
  }

  request.status = REQUEST_STATES.ACCEPTED;
  request.expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h for buyer quantity input
  await request.save();

  // Notify buyer to input quantity
  await sendNotification({
    recipientId: request.buyerId,
    type: 'REQUEST_ACCEPTED',
    title: 'Farmer Accepted Your Request!',
    message: `Farmer accepted your request for "${request.productId?.name}". Please confirm your required quantity within 12 hours.`,
    data: { requestId: request._id, productId: request.productId?._id }
  });

  return request;
}

/**
 * Farmer rejects incoming request
 */
export async function rejectRequest(requestId, farmerId, rejectionReason) {
  const request = await BuyerRequest.findById(requestId).populate('productId');
  if (!request) {
    throw new AppError('Request not found.', 404);
  }

  if (request.farmerId.toString() !== farmerId.toString()) {
    throw new AppError('Unauthorized: You can only reject requests for your own produce.', 403);
  }

  if (request.status !== REQUEST_STATES.REQUESTED) {
    throw new AppError(
      `Invalid state transition: Cannot reject a request that is currently in status "${request.status}".`,
      400
    );
  }

  request.status = REQUEST_STATES.REJECTED;
  request.rejectionReason = rejectionReason || 'Farmer unable to fulfill at this time';
  await request.save();

  // Notify buyer
  await sendNotification({
    recipientId: request.buyerId,
    type: 'REQUEST_REJECTED',
    title: 'Request Declined',
    message: `Farmer was unable to fulfill your request for "${request.productId?.name}". You can discover other nearby farmers on the map.`,
    data: { requestId: request._id }
  });

  return request;
}

/**
 * Buyer cancels request prior to quantity confirmation
 */
export async function cancelRequest(requestId, buyerId, cancellationReason) {
  const request = await BuyerRequest.findById(requestId);
  if (!request) {
    throw new AppError('Request not found.', 404);
  }

  if (request.buyerId.toString() !== buyerId.toString()) {
    throw new AppError('Unauthorized: You can only cancel your own requests.', 403);
  }

  if (![REQUEST_STATES.REQUESTED, REQUEST_STATES.ACCEPTED].includes(request.status)) {
    throw new AppError(
      `Cannot cancel request in status "${request.status}". Only REQUESTED or ACCEPTED requests can be cancelled.`,
      400
    );
  }

  request.status = REQUEST_STATES.CANCELLED;
  request.cancellationReason = cancellationReason || 'Cancelled by buyer';
  await request.save();

  // Notify farmer
  await sendNotification({
    recipientId: request.farmerId,
    type: 'SYSTEM_ALERT',
    title: 'Buyer Cancelled Request',
    message: 'The buyer cancelled their produce request.',
    data: { requestId: request._id }
  });

  return request;
}

/**
 * Get requests for authenticated user based on role
 */
export async function getRequests(userId, role, { status, page = 1, limit = 20 } = {}) {
  const query = role === 'ROLE_FARMER' ? { farmerId: userId } : { buyerId: userId };
  if (status) {
    query.status = status;
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = Math.min(50, Math.max(1, parseInt(limit, 10)));

  const [items, total] = await Promise.all([
    BuyerRequest.find(query)
      .populate('productId', 'name category pricePerUnit unit availableStock images')
      .populate('buyerId', 'name phone buyerDetails')
      .populate('farmerId', 'name phone isVerified farmDetails')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(take),
    BuyerRequest.countDocuments(query)
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
