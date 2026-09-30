import mongoose from 'mongoose';

/**
 * Review Model
 * Level 4 Architecture Reference: Section 1 — Buyer Reviews & Trust Scores
 */
const reviewSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    freshnessRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5
    },
    accuracyRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

reviewSchema.index({ farmerId: 1, rating: -1 });

export const Review = mongoose.model('Review', reviewSchema);
export default Review;
