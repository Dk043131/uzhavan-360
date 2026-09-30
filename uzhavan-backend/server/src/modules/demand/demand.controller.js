import * as demandService from './demand.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function getDemandSignals(req, res, next) {
  try {
    const signals = await demandService.getCommodityDemandSignals(req.query);
    return sendSuccess(res, signals, 'Market demand signals retrieved');
  } catch (err) {
    next(err);
  }
}

export async function matchHarvestOpportunities(req, res, next) {
  try {
    const matches = await demandService.matchFarmerHarvestOpportunities(req.user.id, req.query);
    return sendSuccess(res, matches, 'Harvest sales opportunities matched');
  } catch (err) {
    next(err);
  }
}

export async function getDecisionSupport(req, res, next) {
  try {
    const support = await demandService.getHarvestDecisionSupport(req.user.id, req.query);
    return sendSuccess(res, support, 'Harvest decision support retrieved');
  } catch (err) {
    next(err);
  }
}

export async function matchBuyerDemand(req, res, next) {
  try {
    const matches = await demandService.matchBuyerDemandWithSupply(req.query);
    return sendSuccess(res, matches, 'Buyer demand matched with available farm supply');
  } catch (err) {
    next(err);
  }
}

