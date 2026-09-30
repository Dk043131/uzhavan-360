import express from 'express';
import * as byproductController from './byproducts.controller.js';
import { authenticate, farmerOnly } from '../../middlewares/auth.js';

const router = express.Router();

// Public discovery
router.get('/', byproductController.searchByproducts);

// Farmer only actions
router.use(authenticate);
router.post('/', farmerOnly, byproductController.createByproduct);
router.get('/my-byproducts', farmerOnly, byproductController.getMyByproducts);
router.delete('/:id', farmerOnly, byproductController.deleteByproduct);

export default router;
