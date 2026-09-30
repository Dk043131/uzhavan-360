import { User } from '../auth/user.model.js';
import { Product } from '../products/product.model.js';
import { applyPrivacyJitter } from '../../utils/location.js';
import { computeFreshnessTier } from '../../utils/freshness.js';
import { AppError } from '../../middlewares/errorHandler.js';

/**
 * Get public farmer profile along with active product listings
 */
export async function getFarmerProfile(farmerId) {
  const farmer = await User.findOne({ _id: farmerId, role: 'ROLE_FARMER' }).select('-password');
  if (!farmer) {
    throw new AppError('Farmer profile not found.', 404);
  }

  const products = await Product.find({
    farmerId,
    isAvailable: true,
    isDeleted: false
  }).sort({ createdAt: -1 });

  const exactCoords = {
    lng: farmer.farmDetails?.location?.coordinates?.[0] ?? 76.9558,
    lat: farmer.farmDetails?.location?.coordinates?.[1] ?? 11.0168
  };

  // Privacy fuzzing for public view
  const fuzzedLocation = applyPrivacyJitter(exactCoords, 800);

  const enrichedProducts = products.map((p) => ({
    _id: p._id,
    name: p.name,
    category: p.category,
    unit: p.unit,
    pricePerUnit: p.pricePerUnit,
    availableStock: p.availableStock,
    harvestDate: p.harvestDate,
    freshnessTier: computeFreshnessTier(p.harvestDate, p.category),
    images: p.images || []
  }));

  return {
    farmer: {
      _id: farmer._id,
      name: farmer.name,
      isVerified: farmer.isVerified,
      farmDetails: {
        farmName: farmer.farmDetails?.farmName || `${farmer.name}'s Farm`,
        bio: farmer.farmDetails?.bio,
        address: farmer.farmDetails?.address
      },
      fuzzedLocation
    },
    products: enrichedProducts
  };
}
