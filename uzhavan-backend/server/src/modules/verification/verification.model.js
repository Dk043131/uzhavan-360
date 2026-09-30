import mongoose from 'mongoose';
import { ALL_ROLES } from '@uzhavan360/shared';

/**
 * Verification Model
 * Level 4 Architecture Reference: Section 1 — Farmer KYC & Verification Records
 */
const verificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      required: true
    },
    documentType: {
      type: String,
      enum: ['AADHAAR', 'PATTA_CHITTA', 'KISAN_CREDIT_CARD', 'FARMER_ID', 'GST_CERTIFICATE', 'TRADE_LICENSE'],
      required: true
    },
    documentNumber: {
      type: String,
      required: true,
      trim: true
    },
    documentUrl: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date,
    rejectionReason: String
  },
  {
    timestamps: true
  }
);

verificationSchema.index({ userId: 1, documentType: 1 }, { unique: true });

export const Verification = mongoose.model('Verification', verificationSchema);
export default Verification;
