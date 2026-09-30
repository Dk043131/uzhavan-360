import * as orderService from './orders.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function confirmQuantity(req, res, next) {
  try {
    const { quantity, idempotencyKey, notes } = req.body;
    const order = await orderService.confirmQuantityAndReserve({
      requestId: req.params.requestId,
      buyerId: req.user.id,
      quantity,
      idempotencyKey,
      notes
    });
    return sendSuccess(res, { order }, 'Quantity confirmed and stock reserved', 201);
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const order = await orderService.updateOrderStatus(req.params.id, req.user.id, status);
    return sendSuccess(res, { order }, `Order status updated to ${status}`);
  } catch (err) {
    next(err);
  }
}

export async function completeOrder(req, res, next) {
  try {
    const { fulfilledQuantity } = req.body;
    const order = await orderService.completeOrder(req.params.id, req.user.id, fulfilledQuantity);
    return sendSuccess(res, { order }, 'Order marked as completed');
  } catch (err) {
    next(err);
  }
}

export async function markNoShow(req, res, next) {
  try {
    const order = await orderService.markBuyerNoShow(req.params.id, req.user.id);
    return sendSuccess(res, { order }, 'Order marked as No-Show; reserved stock released');
  } catch (err) {
    next(err);
  }
}

export async function cancelOrderByBuyer(req, res, next) {
  try {
    const { reason } = req.body;
    const order = await orderService.cancelOrderByBuyer(req.params.id, req.user.id, reason);
    return sendSuccess(res, { order }, 'Order cancelled by buyer');
  } catch (err) {
    next(err);
  }
}

export async function cancelOrderByFarmer(req, res, next) {
  try {
    const { reason } = req.body;
    const order = await orderService.cancelOrderByFarmer(req.params.id, req.user.id, reason);
    return sendSuccess(res, { order }, 'Order cancelled by farmer');
  } catch (err) {
    next(err);
  }
}

export async function getOrders(req, res, next) {
  try {
    const result = await orderService.getOrders(req.user.id, req.user.role, req.query);
    return sendSuccess(res, result, 'Orders retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(req, res, next) {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user.id);
    return sendSuccess(res, { order }, 'Order retrieved');
  } catch (err) {
    next(err);
  }
}

export async function expireReservations(req, res, next) {
  try {
    const expired = await orderService.checkAndExpireReservations();
    return sendSuccess(res, { expiredCount: expired.length, expired }, 'Expired reservations processed');
  } catch (err) {
    next(err);
  }
}

