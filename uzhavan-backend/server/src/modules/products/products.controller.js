import * as productService from './products.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function createProduct(req, res, next) {
  try {
    const product = await productService.createProduct(req.user.id, req.body);
    return sendSuccess(res, { product }, 'Product created successfully', 201);
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req, res, next) {
  try {
    const product = await productService.getProductById(req.params.id);
    return sendSuccess(res, { product }, 'Product details retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getMyProducts(req, res, next) {
  try {
    const products = await productService.getFarmerProducts(req.user.id);
    return sendSuccess(res, { products }, 'Farmer products retrieved');
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const product = await productService.updateProduct(req.params.id, req.user.id, req.body);
    return sendSuccess(res, { product }, 'Product updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const result = await productService.deleteProduct(req.params.id, req.user.id);
    return sendSuccess(res, result, 'Product deleted successfully');
  } catch (err) {
    next(err);
  }
}
