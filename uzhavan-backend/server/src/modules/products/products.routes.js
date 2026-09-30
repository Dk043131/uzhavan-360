import express from 'express';
import * as productController from './products.controller.js';
import { authenticate, farmerOnly } from '../../middlewares/auth.js';

const router = express.Router();

// Public route to view a product
router.get('/:id', productController.getProduct);

// Protected routes (Farmer only)
router.use(authenticate);
router.post('/', farmerOnly, productController.createProduct);
router.get('/farmer/my-products', farmerOnly, productController.getMyProducts);
router.put('/:id', farmerOnly, productController.updateProduct);
router.patch('/:id', farmerOnly, productController.updateProduct);
router.delete('/:id', farmerOnly, productController.deleteProduct);

export default router;
