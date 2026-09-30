import express from 'express';
import * as marketplaceController from './marketplace.controller.js';

const router = express.Router();

// Public marketplace discovery
router.get('/', marketplaceController.search);

export default router;
