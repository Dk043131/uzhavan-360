import { env } from '../config/env.js';

/**
 * Cloudinary Upload Service Abstraction
 * Level 1 Architecture Reference: Section 15 & 31
 *
 * At Level 2 this establishes the provider boundary.
 * Full upload/delete implementation lands in Level 3.
 * The import is deferred so the app starts without valid Cloudinary keys.
 */

let cloudinaryInstance = null;

async function getCloudinary() {
  if (!env.cloudinary.isConfigured) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in server/.env'
    );
  }

  if (!cloudinaryInstance) {
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
      secure: true
    });
    cloudinaryInstance = cloudinary;
  }

  return cloudinaryInstance;
}

/**
 * Upload a file buffer or stream to Cloudinary.
 * @param {Buffer|string} fileData - File buffer or local path
 * @param {object} options - Cloudinary upload options
 * @returns {Promise<object>} Cloudinary upload result
 */
export async function uploadImage(fileData, options = {}) {
  const cloudinary = await getCloudinary();

  const uploadOptions = {
    folder: options.folder || 'uzhavan360/general',
    transformation: [
      { width: 1200, height: 900, crop: 'limit', quality: 'auto', fetch_format: 'webp' }
    ],
    ...options
  };

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });

    if (Buffer.isBuffer(fileData)) {
      uploadStream.end(fileData);
    } else {
      reject(new Error('uploadImage: fileData must be a Buffer'));
    }
  });
}

/**
 * Delete an image from Cloudinary by public_id
 * @param {string} publicId - Cloudinary public ID
 */
export async function deleteImage(publicId) {
  const cloudinary = await getCloudinary();
  return cloudinary.uploader.destroy(publicId);
}

/**
 * Check whether Cloudinary is configured
 */
export function isCloudinaryReady() {
  return env.cloudinary.isConfigured;
}

export const cloudinaryFolders = Object.freeze({
  PRODUCT_IMAGES: 'uzhavan360/products',
  FARMER_PROFILE: 'uzhavan360/farmers',
  BYPRODUCT_IMAGES: 'uzhavan360/byproducts'
});
