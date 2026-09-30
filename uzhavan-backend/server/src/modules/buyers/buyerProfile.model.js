import mongoose from 'mongoose';

const buyerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    businessName: {
      type: String,
      trim: true,
      maxlength: 120
    },
    businessType: {
      type: String,
      enum: ['RETAIL', 'WHOLESALE', 'RESTAURANT', 'HOUSEHOLD', 'PROCESSOR', 'EXPORTER', 'OTHER'],
      default: 'HOUSEHOLD'
    },
    gstin: {
      type: String,
      trim: true,
      sparse: true
    },
    preferredCategories: [
      {
        type: String,
        enum: ['LEAFY', 'FLOWER', 'FRUITING', 'TUBER', 'ROOT', 'GRAIN', 'CITRUS', 'OTHER']
      }
    ],
    defaultDeliveryPreference: {
      type: String,
      enum: ['FARMGATE_PICKUP', 'DELIVERY_REQUESTED', 'FARMER_TRANSPORT'],
      default: 'FARMGATE_PICKUP'
    },
    billingAddress: {
      street: String,
      city: String,
      district: String,
      state: { type: String, default: 'Tamil Nadu' },
      pincode: String
    },
    totalOrdersCompleted: {
      type: Number,
      default: 0
    },
    noShowCount: {
      type: Number,
      default: 0
    },
    reliabilityScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    }
  },
  {
    timestamps: true
  }
);

buyerProfileSchema.index({ businessType: 1, reliabilityScore: -1 });

export const BuyerProfile = mongoose.model('BuyerProfile', buyerProfileSchema);
export default BuyerProfile;
