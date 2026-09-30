import * as notifService from './notifications.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function getNotifications(req, res, next) {
  try {
    const result = await notifService.getNotifications(req.user.id, req.query);
    return sendSuccess(res, result, 'Notifications retrieved');
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const result = await notifService.markAsRead(req.params.id, req.user.id);
    return sendSuccess(res, result, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    await notifService.markAllAsRead(req.user.id);
    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
}
