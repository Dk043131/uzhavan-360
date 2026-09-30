import { User } from '../auth/user.model.js';
import { Product } from '../products/product.model.js';
import { Order } from '../orders/order.model.js';
import { BuyerRequest } from '../requests/request.model.js';
import { InventoryLedger } from '../inventory/inventoryLedger.model.js';
import { HarvestByproduct } from '../byproducts/byproduct.model.js';
import { Notification } from '../notifications/notification.model.js';
import { UzhavanAuditLog } from '../uzhavan/uzhavanAuditLog.model.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { ROLES, ORDER_STATES } from '@uzhavan360/shared';

/**
 * Get system-wide operational metrics and telemetry overview
 */
export async function getAdminOverview() {
  const [
    totalUsers,
    farmersCount,
    buyersCount,
    verifiedFarmersCount,
    totalProducts,
    activeProducts,
    totalOrders,
    completedOrders,
    totalRequests,
    totalLedgerEntries,
    totalByproducts,
    totalNotifications,
    totalAiAuditLogs
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: ROLES.FARMER }),
    User.countDocuments({ role: ROLES.BUYER }),
    User.countDocuments({ role: ROLES.FARMER, isVerified: true }),
    Product.countDocuments({ isDeleted: false }),
    Product.countDocuments({ isDeleted: false, isAvailable: true, availableStock: { $gt: 0 } }),
    Order.countDocuments(),
    Order.countDocuments({ status: { $in: [ORDER_STATES.COMPLETED, ORDER_STATES.COMPLETED_PARTIAL] } }),
    BuyerRequest.countDocuments(),
    InventoryLedger.countDocuments(),
    HarvestByproduct.countDocuments(),
    Notification.countDocuments(),
    UzhavanAuditLog.countDocuments()
  ]);

  // Aggregate gross completed order volume (Order Value at Farmgate)
  const completedOrdersAgg = await Order.aggregate([
    { $match: { status: { $in: [ORDER_STATES.COMPLETED, ORDER_STATES.COMPLETED_PARTIAL] } } },
    { $group: { _id: null, totalOrderValue: { $sum: '$totalAmount' }, totalFulfilledQty: { $sum: '$fulfilledQuantity' } } }
  ]);

  const grossCompletedValue = completedOrdersAgg[0]?.totalOrderValue || 0;
  const grossFulfilledKg = completedOrdersAgg[0]?.totalFulfilledQty || 0;

  // Order count by status
  const ordersByStatusAgg = await Order.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  const orderStatusMap = {};
  ordersByStatusAgg.forEach((item) => {
    orderStatusMap[item._id] = item.count;
  });

  return {
    users: {
      total: totalUsers,
      farmers: farmersCount,
      buyers: buyersCount,
      verifiedFarmers: verifiedFarmersCount
    },
    products: {
      total: totalProducts,
      activeWithStock: activeProducts
    },
    orders: {
      total: totalOrders,
      completed: completedOrders,
      statusBreakdown: orderStatusMap,
      grossCompletedValue: parseFloat(grossCompletedValue.toFixed(2)),
      grossFulfilledQuantity: parseFloat(grossFulfilledKg.toFixed(1))
    },
    requests: {
      total: totalRequests
    },
    inventory: {
      totalLedgerTransactions: totalLedgerEntries
    },
    byproducts: {
      totalListings: totalByproducts
    },
    notifications: {
      totalDispatched: totalNotifications
    },
    aiObservability: {
      totalAuditLogs: totalAiAuditLogs
    },
    timestamp: new Date()
  };
}

/**
 * Get paginated users for admin management
 */
export async function getAdminUsers({ role, isVerified, page = 1, limit = 20 } = {}) {
  const query = {};
  if (role) query.role = role;
  if (isVerified !== undefined) query.isVerified = isVerified === 'true' || isVerified === true;

  const take = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const pageNum = Math.max(1, parseInt(page, 10));

  const [items, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * take)
      .limit(take),
    User.countDocuments(query)
  ]);

  return {
    items,
    pagination: {
      page: pageNum,
      limit: take,
      total,
      pages: Math.ceil(total / take)
    }
  };
}

/**
 * Toggle farmer verification status
 */
export async function toggleFarmerVerification(userId, isVerified) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  if (user.role !== ROLES.FARMER) {
    throw new AppError('Only farmer accounts can be verified.', 400);
  }

  user.isVerified = Boolean(isVerified);
  await user.save();

  return {
    userId: user._id,
    name: user.name,
    isVerified: user.isVerified
  };
}

/**
 * Get AI audit logs with pagination and filters
 */
export async function getAdminAuditLogs({ status, toolName, page = 1, limit = 20 } = {}) {
  const query = {};
  if (status) query.status = status;
  if (toolName) query.toolSelected = toolName;

  const take = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const pageNum = Math.max(1, parseInt(page, 10));

  const [items, total] = await Promise.all([
    UzhavanAuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * take)
      .limit(take),
    UzhavanAuditLog.countDocuments(query)
  ]);

  return {
    items,
    pagination: {
      page: pageNum,
      limit: take,
      total,
      pages: Math.ceil(total / take)
    }
  };
}
