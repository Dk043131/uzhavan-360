import { Notification } from './notification.model.js';

/**
 * Dispatch an in-app notification.
 * Protected: failure to create notification never throws to caller,
 * ensuring business transactions are not aborted by notification delivery.
 */
export async function sendNotification({ recipientId, type, title, message, data = {} }) {
  try {
    const notif = await Notification.create({
      recipientId,
      type,
      title,
      message,
      data
    });
    return notif;
  } catch (err) {
    console.error(`[NOTIFICATION ERROR] Failed to send notification to ${recipientId}:`, err.message);
    return null;
  }
}

/**
 * Fetch paginated notifications for a user
 */
export async function getNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
  const query = { recipientId: userId };
  if (unreadOnly) {
    query.isRead = false;
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const take = Math.min(50, Math.max(1, parseInt(limit, 10)));

  const [items, total] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(take),
    Notification.countDocuments(query)
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
 * Mark a specific notification as read
 */
export async function markAsRead(notificationId, userId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipientId: userId },
    { isRead: true },
    { new: true }
  );
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId) {
  return Notification.updateMany({ recipientId: userId, isRead: false }, { isRead: true });
}
