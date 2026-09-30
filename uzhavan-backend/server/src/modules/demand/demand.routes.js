import express from 'express';
import * as demandController from './demand.controller.js';
import { authenticate, farmerOnly } from '../../middlewares/auth.js';

const router = express.Router();

// Public / Authenticated demand signals
router.get('/signals', demandController.getDemandSignals);
router.get('/match-supply', demandController.matchBuyerDemand);

// Farmer only: "Sell My Harvest" opportunities & Decision Support
router.get('/sell-my-harvest', authenticate, farmerOnly, demandController.matchHarvestOpportunities);
router.get('/decision-support', authenticate, farmerOnly, demandController.getDecisionSupport);

export default router;
