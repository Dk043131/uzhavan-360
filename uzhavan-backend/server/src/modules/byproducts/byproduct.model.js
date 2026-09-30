import mongoose from 'mongoose';
import { ALL_UNITS, UNITS } from '@uzhavan360/shared';

const byproductSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Byproduct name is required'],
      trim: true,
      maxlength: 120
    },
    category: {
      type: String,
      required: true,
      enum: [
        'PADDY_STRAW',
        'WHEAT_STRAW',
        'SUGARCANE_BAGASSE',
        'CORN_STALKS',
        'BANANA_STEMS',
        'COCONUT_SHELLS',
        'FARM_MANURE',
        'CROP_RESIDUE',
        'FRUIT_RESIDUES',
        'VEGETABLE_RESIDUES',
        'OTHER'
      ],
      default: 'OTHER'
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.1, 'Quantity must be positive']
    },
    unit: {
      type: String,
      enum: ALL_UNITS,
      default: UNITS.TON
    },
    expectedPrice: {
      type: Number,
      default: 0
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true
      }
    },
    address: {
      village: String,
      district: String,
      state: { type: String, default: 'Tamil Nadu' },
      pincode: String
    },
    availableFrom: {
      type: Date,
      default: Date.now
    },
    moistureLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'UNSPECIFIED'],
      default: 'UNSPECIFIED'
    },
    packagingType: {
      type: String,
      enum: ['BALED', 'LOOSE', 'BAGGED', 'OTHER'],
      default: 'LOOSE'
    },
    potentialUses: [
      {
        type: String,
        trim: true
      }
    ],
    description: {
      type: String,
      trim: true
    },
    images: [
      {
        url: String,
        publicId: String
      }
    ],
    status: {
      type: String,
      enum: ['AVAILABLE', 'RESERVED', 'SOLD'],
      default: 'AVAILABLE',
      index: true
    }
  },
  {
    timestamps: true
  }
);

byproductSchema.index({ location: '2dsphere' });

export const HarvestByproduct = mongoose.model('HarvestByproduct', byproductSchema);
export default HarvestByproduct;
