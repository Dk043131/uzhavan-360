import express from 'express';
import * as orderController from './orders.controller.js';
import { authenticate, farmerOnly, buyerOnly } from '../../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

// Buyer confirms quantity & initiates reservation
router.post('/confirm-quantity/:requestId', buyerOnly, orderController.confirmQuantity);

// Order status updates (Farmer)
router.patch('/:id/status', farmerOnly, orderController.updateStatus);
router.patch('/:id/complete', farmerOnly, orderController.completeOrder);
router.patch('/:id/no-show', farmerOnly, orderController.markNoShow);

// Cancellations
router.patch('/:id/cancel-by-buyer', buyerOnly, orderController.cancelOrderByBuyer);
router.patch('/:id/cancel-by-farmer', farmerOnly, orderController.cancelOrderByFarmer);

// List and single fetch
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrderById);

// Manual or worker trigger for expiring reservations
router.post('/expire-reservations', orderController.expireReservations);

export default router;
