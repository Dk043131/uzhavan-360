import * as usersService from './users.service.js';
import { sendSuccess } from '../../utils/response.js';

export async function getProfile(req, res, next) {
  try {
    const user = await usersService.getProfile(req.user.id);
    return sendSuccess(res, { user }, 'Profile retrieved');
  } catch (err) { next(err); }
}

export async function updateProfile(req, res, next) {
  try {
    const user = await usersService.updateProfile(req.user.id, req.body);
    return sendSuccess(res, { user }, 'Profile updated');
  } catch (err) { next(err); }
}
