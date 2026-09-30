import express from 'express';
import * as notifController from './notifications.controller.js';
import { authenticate } from '../../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', notifController.getNotifications);
router.patch('/:id/read', notifController.markAsRead);
router.patch('/read-all', notifController.markAllAsRead);

export default router;
