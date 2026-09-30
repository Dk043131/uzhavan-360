import * as inventoryService from './inventory.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function recordOffPlatformSale(req, res, next) {
  try {
    const { productId, quantity, reason } = req.body;
    const updatedProduct = await inventoryService.recordOffPlatformSale({
      productId,
      farmerId: req.user.id,
      quantity: parseFloat(quantity),
      reason
    });
    return sendSuccess(res, { product: updatedProduct }, 'Off-platform sale recorded successfully');
  } catch (err) {
    next(err);
  }
}

export async function addHarvest(req, res, next) {
  try {
    const { productId, quantity, reason } = req.body;
    const updatedProduct = await inventoryService.addHarvestBatch({
      productId,
      farmerId: req.user.id,
      quantity: parseFloat(quantity),
      reason
    });
    return sendSuccess(res, { product: updatedProduct }, 'New harvest stock added successfully');
  } catch (err) {
    next(err);
  }
}

export async function getLedgerHistory(req, res, next) {
  try {
    const { productId } = req.params;
    const history = await inventoryService.getInventoryHistory(productId, req.user.id);
    return sendSuccess(res, { history }, 'Inventory ledger history retrieved');
  } catch (err) {
    next(err);
  }
}
