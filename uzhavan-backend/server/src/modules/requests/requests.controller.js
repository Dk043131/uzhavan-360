import * as requestService from './requests.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function createRequest(req, res, next) {
  try {
    const request = await requestService.createRequest(req.user.id, req.body);
    return sendSuccess(res, { request }, 'Request submitted to farmer', 201);
  } catch (err) {
    next(err);
  }
}

export async function acceptRequest(req, res, next) {
  try {
    const request = await requestService.acceptRequest(req.params.id, req.user.id);
    return sendSuccess(res, { request }, 'Request accepted by farmer');
  } catch (err) {
    next(err);
  }
}

export async function rejectRequest(req, res, next) {
  try {
    const { reason } = req.body;
    const request = await requestService.rejectRequest(req.params.id, req.user.id, reason);
    return sendSuccess(res, { request }, 'Request rejected');
  } catch (err) {
    next(err);
  }
}

export async function cancelRequest(req, res, next) {
  try {
    const { reason } = req.body;
    const request = await requestService.cancelRequest(req.params.id, req.user.id, reason);
    return sendSuccess(res, { request }, 'Request cancelled');
  } catch (err) {
    next(err);
  }
}

export async function getMyRequests(req, res, next) {
  try {
    const result = await requestService.getRequests(req.user.id, req.user.role, req.query);
    return sendSuccess(res, result, 'Requests retrieved');
  } catch (err) {
    next(err);
  }
}
