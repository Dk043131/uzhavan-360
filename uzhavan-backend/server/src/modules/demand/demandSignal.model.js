import mongoose from 'mongoose';
import { DEMAND_TRENDS, ALL_UNITS, UNITS } from '@uzhavan360/shared';

/**
 * DemandSignal Model
 * Level 4 Architecture Reference: Section 1 & Section 14 — Demand Intelligence
 * Stores aggregated demand snapshots by category/commodity and geographic district.
 */
const demandSignalSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ['LEAFY', 'FLOWER', 'FRUITING', 'TUBER', 'ROOT', 'GRAIN', 'CITRUS', 'OTHER'],
      index: true
    },
    commodityName: {
      type: String,
      trim: true,
      index: true
    },
    district: {
      type: String,
      required: true,
      default: 'Coimbatore',
      index: true
    },
    timeframeStart: {
      type: Date,
      required: true
    },
    timeframeEnd: {
      type: Date,
      required: true
    },
    requestCount: {
      type: Number,
      required: true,
      default: 0
    },
    previousRequestCount: {
      type: Number,
      default: 0
    },
    growthPercentage: {
      type: Number,
      default: 0
    },
    estimatedVolumeDemand: {
      type: Number,
      default: 0
    },
    unit: {
      type: String,
      enum: ALL_UNITS,
      default: UNITS.KG
    },
    trend: {
      type: String,
      enum: Object.values(DEMAND_TRENDS),
      default: DEMAND_TRENDS.STABLE
    },
    confidenceScore: {
      type: Number,
      default: 80,
      min: 0,
      max: 100
    },
    disclaimer: {
      type: String,
      default: 'Based strictly on internal Uzhavan 360 marketplace telemetry.'
    }
  },
  {
    timestamps: true
  }
);

demandSignalSchema.index({ category: 1, district: 1, timeframeEnd: -1 });

export const DemandSignal = mongoose.model('DemandSignal', demandSignalSchema);
export default DemandSignal;
