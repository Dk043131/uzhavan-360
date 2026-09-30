import jwt from 'jsonwebtoken';
import { User } from './user.model.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middlewares/errorHandler.js';

/**
 * Generate signed JWT token
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      phone: user.phone
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Register a new user
 */
export async function register(userData) {
  const { name, phone, email, password, role, farmDetails, buyerDetails } = userData;

  const existingUser = await User.findOne({ phone });
  if (existingUser) {
    throw new AppError('A user with this mobile number already exists.', 409);
  }

  if (email) {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      throw new AppError('A user with this email address already exists.', 409);
    }
  }

  // Handle location coordinates if provided as lat/lng
  const userPayload = {
    name,
    phone,
    email,
    password,
    role: role || 'ROLE_BUYER'
  };

  if (farmDetails) {
    userPayload.farmDetails = farmDetails;
    if (farmDetails.latitude && farmDetails.longitude) {
      userPayload.farmDetails.location = {
        type: 'Point',
        coordinates: [parseFloat(farmDetails.longitude), parseFloat(farmDetails.latitude)]
      };
    }
  }

  if (buyerDetails) {
    userPayload.buyerDetails = buyerDetails;
  }

  const user = await User.create(userPayload);
  const token = generateToken(user);

  const sanitizedUser = user.toObject();
  delete sanitizedUser.password;

  return { user: sanitizedUser, token };
}

/**
 * Authenticate user and return token
 */
export async function login({ phone, password }) {
  if (!phone || !password) {
    throw new AppError('Please provide phone number and password.', 400);
  }

  const user = await User.findOne({ phone }).select('+password');
  if (!user) {
    throw new AppError('Invalid credentials. User not found.', 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid credentials. Incorrect password.', 401);
  }

  const token = generateToken(user);
  const sanitizedUser = user.toObject();
  delete sanitizedUser.password;

  return { user: sanitizedUser, token };
}

/**
 * Get profile of authenticated user
 */
export async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }
  return user;
}
