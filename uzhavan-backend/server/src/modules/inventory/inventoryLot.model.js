import mongoose from 'mongoose';
import { ALL_UNITS, UNITS } from '@uzhavan360/shared';

/**
 * InventoryLot Model
 * Level 4 Architecture Reference: Section 1 & 2 — Inventory Integrity & Lot Tracking
 * Tracks physical harvest batches linked to a Product catalog entry.
 */
const inventoryLotSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Farmer ID is required'],
      index: true
    },
    lotNumber: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    harvestDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    initialQuantity: {
      type: Number,
      required: true,
      min: [0.01, 'Quantity must be positive']
    },
    availableQuantity: {
      type: Number,
      required: true,
      min: [0, 'Available quantity cannot be negative']
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Reserved quantity cannot be negative']
    },
    soldQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Sold quantity cannot be negative']
    },
    unit: {
      type: String,
      enum: ALL_UNITS,
      default: UNITS.KG
    },
    qualityGrade: {
      type: String,
      enum: ['GRADE_A', 'GRADE_B', 'STANDARD', 'ORGANIC_PREMIUM'],
      default: 'GRADE_A'
    },
    storageConditions: {
      type: String,
      enum: ['AMBIENT_FARMGATE', 'COLD_STORAGE', 'SHADE_DRIED', 'VENTILATED_CRATES'],
      default: 'AMBIENT_FARMGATE'
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'DEPLETED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true
    },
    notes: String
  },
  {
    timestamps: true
  }
);

inventoryLotSchema.index({ productId: 1, status: 1, harvestDate: 1 });
inventoryLotSchema.index({ farmerId: 1, lotNumber: 1 }, { unique: true });

export const InventoryLot = mongoose.model('InventoryLot', inventoryLotSchema);
export default InventoryLot;
