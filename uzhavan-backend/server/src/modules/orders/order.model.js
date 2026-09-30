import mongoose from 'mongoose';
import { ORDER_STATES, ALL_UNITS, UNITS } from '@uzhavan360/shared';

const orderSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BuyerRequest',
      required: true,
      index: true
    },
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
    reservedQuantity: {
      type: Number,
      required: [true, 'Reserved quantity is required'],
      min: [0.01, 'Quantity must be positive']
    },
    fulfilledQuantity: {
      type: Number,
      default: 0
    },
    unit: {
      type: String,
      enum: ALL_UNITS,
      default: UNITS.KG
    },
    unitPrice: {
      type: Number,
      required: true
    },
    totalAmount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATES),
      default: ORDER_STATES.RESERVED,
      index: true
    },
    pickupLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number],
      address: Object
    },
    reservationExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 12 * 60 * 60 * 1000) // 12 hours TTL
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true
    },
    cancellationReason: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const Order = mongoose.model('Order', orderSchema);
export default Order;
