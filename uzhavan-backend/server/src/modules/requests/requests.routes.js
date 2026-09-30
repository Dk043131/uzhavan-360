import express from 'express';
import * as requestController from './requests.controller.js';
import { authenticate, farmerOnly, buyerOnly } from '../../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

// Buyer creates request
router.post('/', buyerOnly, requestController.createRequest);

// Farmer accepts or rejects
router.patch('/:id/accept', farmerOnly, requestController.acceptRequest);
router.patch('/:id/reject', farmerOnly, requestController.rejectRequest);

// Buyer cancels
router.patch('/:id/cancel', buyerOnly, requestController.cancelRequest);

// Get requests for authenticated user
router.get('/', requestController.getMyRequests);

export default router;
