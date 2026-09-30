import * as adminService from './admin.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function getOverview(req, res, next) {
  try {
    const overview = await adminService.getAdminOverview();
    return sendSuccess(res, overview, 'Admin platform overview retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getUsers(req, res, next) {
  try {
    const users = await adminService.getAdminUsers(req.query);
    return sendSuccess(res, users, 'Admin users retrieved');
  } catch (err) {
    next(err);
  }
}

export async function verifyFarmer(req, res, next) {
  try {
    const { isVerified } = req.body;
    const result = await adminService.toggleFarmerVerification(req.params.id, isVerified);
    return sendSuccess(res, result, `Farmer verification updated to ${result.isVerified}`);
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    const logs = await adminService.getAdminAuditLogs(req.query);
    return sendSuccess(res, logs, 'Admin AI audit logs retrieved');
  } catch (err) {
    next(err);
  }
}
