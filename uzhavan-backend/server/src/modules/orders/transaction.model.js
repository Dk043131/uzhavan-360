import mongoose from 'mongoose';

/**
 * Transaction Model
 * Level 4 Architecture Reference: Section 1 — Financial & Payment Records
 */
const transactionSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
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
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Transaction amount must be positive']
    },
    currency: {
      type: String,
      default: 'INR'
    },
    paymentMode: {
      type: String,
      enum: ['CASH_ON_PICKUP', 'UPI_DIRECT', 'BANK_TRANSFER', 'OFF_PLATFORM_CASH'],
      default: 'CASH_ON_PICKUP'
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true
    },
    referenceNumber: {
      type: String,
      trim: true
    },
    notes: String,
    completedAt: Date
  },
  {
    timestamps: true
  }
);

transactionSchema.index({ orderId: 1, paymentStatus: 1 });
transactionSchema.index({ farmerId: 1, createdAt: -1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
