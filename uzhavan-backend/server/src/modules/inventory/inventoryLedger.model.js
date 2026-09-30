import mongoose from 'mongoose';
import { INVENTORY_TRANSACTION_TYPES } from '@uzhavan360/shared';

const inventoryLedgerSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    transactionType: {
      type: String,
      required: true,
      enum: Object.values(INVENTORY_TRANSACTION_TYPES)
    },
    quantityDelta: {
      type: Number,
      required: true
    },
    totalBefore: { type: Number, required: true },
    totalAfter: { type: Number, required: true },
    availableBefore: { type: Number, required: true },
    availableAfter: { type: Number, required: true },
    reservedBefore: { type: Number, required: true },
    reservedAfter: { type: Number, required: true },
    soldBefore: { type: Number, required: true },
    soldAfter: { type: Number, required: true },
    referenceId: {
      type: String, // Can store Order ID, Request ID, or offline receipt
      default: null
    },
    reason: {
      type: String,
      default: null
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false } // Immutable audit ledger
  }
);

inventoryLedgerSchema.index({ productId: 1, createdAt: -1 });

export const InventoryLedger = mongoose.model('InventoryLedger', inventoryLedgerSchema);
export default InventoryLedger;
