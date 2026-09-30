import { User } from '../auth/user.model.js';
import { AppError } from '../../middlewares/errorHandler.js';

export async function getProfile(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) throw new AppError('User not found.', 404);
  return user;
}

export async function updateProfile(userId, updates) {
  const allowed = ['name', 'email', 'farmDetails', 'buyerDetails'];
  const sanitized = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) sanitized[key] = updates[key];
  }

  // Handle location update within farmDetails
  if (sanitized.farmDetails?.latitude && sanitized.farmDetails?.longitude) {
    sanitized['farmDetails.location'] = {
      type: 'Point',
      coordinates: [
        parseFloat(sanitized.farmDetails.longitude),
        parseFloat(sanitized.farmDetails.latitude)
      ]
    };
    delete sanitized.farmDetails.latitude;
    delete sanitized.farmDetails.longitude;
  }

  const user = await User.findByIdAndUpdate(userId, { $set: sanitized }, { new: true, runValidators: true }).select('-password');
  if (!user) throw new AppError('User not found.', 404);
  return user;
}
