import mongoose from 'mongoose';
import { ALL_UNITS, UNITS } from '@uzhavan360/shared';

const productSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Farmer ID is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: 120
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['LEAFY', 'FLOWER', 'FRUITING', 'TUBER', 'ROOT', 'GRAIN', 'CITRUS', 'OTHER'],
      default: 'OTHER'
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      enum: ALL_UNITS,
      default: UNITS.KG
    },
    pricePerUnit: {
      type: Number,
      required: [true, 'Price per unit is required'],
      min: [0.01, 'Price must be greater than zero']
    },
    // Double-Entry Inventory Counters
    // Invariant: totalStock = availableStock + reservedStock + soldStock
    totalStock: {
      type: Number,
      required: [true, 'Total stock is required'],
      min: [0, 'Total stock cannot be negative']
    },
    availableStock: {
      type: Number,
      required: true,
      min: [0, 'Available stock cannot be negative']
    },
    reservedStock: {
      type: Number,
      default: 0,
      min: [0, 'Reserved stock cannot be negative']
    },
    soldStock: {
      type: Number,
      default: 0,
      min: [0, 'Sold stock cannot be negative']
    },
    harvestDate: {
      type: Date,
      required: [true, 'Harvest date is required'],
      default: Date.now
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },
    address: {
      village: String,
      district: String,
      state: { type: String, default: 'Tamil Nadu' },
      pincode: String
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    images: [
      {
        url: String,
        publicId: String
      }
    ],
    isAvailable: {
      type: Boolean,
      default: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Geospatial index for discovery
productSchema.index({ location: '2dsphere' });

// Compound indexes for optimized marketplace queries
productSchema.index({ farmerId: 1, isDeleted: 1, isAvailable: 1 });
productSchema.index({ category: 1, isAvailable: 1, isDeleted: 1, pricePerUnit: 1 });
productSchema.index({ isAvailable: 1, isDeleted: 1, harvestDate: -1 }); // Freshness-sorted discovery
productSchema.index({ farmerId: 1, category: 1, isDeleted: 1 });       // Farmer inventory management

// TTL: Auto-archive soft-deleted products after 90 days (optional — Mongoose will create this)
// productSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 7776000, sparse: true });

// Ensure isAvailable reflects availableStock
productSchema.pre('save', function (next) {
  if (this.availableStock <= 0) {
    this.isAvailable = false;
  } else if (!this.isDeleted) {
    this.isAvailable = true;
  }
  next();
});

export const Product = mongoose.model('Product', productSchema);
export default Product;
