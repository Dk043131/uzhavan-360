import * as byproductService from './byproducts.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function createByproduct(req, res, next) {
  try {
    const byproduct = await byproductService.createByproductListing(req.user.id, req.body);
    return sendSuccess(res, { byproduct }, 'Harvest byproduct listed successfully', 201);
  } catch (err) {
    next(err);
  }
}

export async function searchByproducts(req, res, next) {
  try {
    const result = await byproductService.searchByproducts(req.query);
    return sendSuccess(res, result, 'Harvest byproducts retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getMyByproducts(req, res, next) {
  try {
    const byproducts = await byproductService.getFarmerByproducts(req.user.id);
    return sendSuccess(res, { byproducts }, 'Farmer byproducts retrieved');
  } catch (err) {
    next(err);
  }
}

export async function deleteByproduct(req, res, next) {
  try {
    const result = await byproductService.deleteByproduct(req.params.id, req.user.id);
    return sendSuccess(res, result, 'Byproduct deleted successfully');
  } catch (err) {
    next(err);
  }
}
