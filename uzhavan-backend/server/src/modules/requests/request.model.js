import mongoose from 'mongoose';
import { REQUEST_STATES } from '@uzhavan360/shared';

const requestSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(REQUEST_STATES),
      default: REQUEST_STATES.REQUESTED,
      index: true
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500
    },
    rejectionReason: {
      type: String,
      trim: true
    },
    cancellationReason: {
      type: String,
      trim: true
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24h
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate active requests from the same buyer on the same product
requestSchema.index(
  { buyerId: 1, productId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: REQUEST_STATES.REQUESTED }
  }
);

export const BuyerRequest = mongoose.model('BuyerRequest', requestSchema);
export const PurchaseRequest = BuyerRequest;
export default BuyerRequest;
