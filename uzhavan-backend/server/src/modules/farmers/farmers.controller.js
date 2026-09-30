import * as farmerService from './farmers.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function getFarmerProfile(req, res, next) {
  try {
    const profile = await farmerService.getFarmerProfile(req.params.id);
    return sendSuccess(res, profile, 'Farmer profile retrieved');
  } catch (err) {
    next(err);
  }
}
