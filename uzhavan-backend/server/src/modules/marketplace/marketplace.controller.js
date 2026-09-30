import * as marketplaceService from './marketplace.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function search(req, res, next) {
  try {
    const result = await marketplaceService.searchMarketplace(req.query);
    return sendSuccess(res, result, 'Marketplace listings retrieved');
  } catch (err) {
    next(err);
  }
}
