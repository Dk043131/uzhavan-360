import express from 'express';
import * as inventoryController from './inventory.controller.js';
import { authenticate, farmerOnly } from '../../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

// Farmer only actions
router.post('/off-platform-sale', farmerOnly, inventoryController.recordOffPlatformSale);
router.post('/add-harvest', farmerOnly, inventoryController.addHarvest);
router.get('/history/:productId', farmerOnly, inventoryController.getLedgerHistory);

export default router;
