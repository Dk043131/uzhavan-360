import mongoose from 'mongoose';

const farmerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    farmName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    acreage: {
      type: Number,
      min: [0.1, 'Acreage must be at least 0.1 acres']
    },
    farmingPractice: {
      type: String,
      enum: ['ORGANIC', 'NATURAL', 'CONVENTIONAL', 'ZERO_BUDGET', 'HYDROPONIC', 'OTHER'],
      default: 'NATURAL'
    },
    primaryCrops: [
      {
        type: String,
        trim: true
      }
    ],
    soilType: {
      type: String,
      enum: ['RED_SOIL', 'BLACK_SOIL', 'ALLUVIAL', 'CLAY', 'LOAMY', 'SANDY', 'OTHER'],
      default: 'RED_SOIL'
    },
    irrigationSource: {
      type: String,
      enum: ['WELL', 'BOREWELL', 'CANAL', 'RAIN_FED', 'DRIP', 'OTHER'],
      default: 'BOREWELL'
    },
    experienceYears: {
      type: Number,
      default: 0
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        default: [76.9558, 11.0168]
      }
    },
    address: {
      village: String,
      taluk: String,
      district: { type: String, default: 'Coimbatore' },
      state: { type: String, default: 'Tamil Nadu' },
      pincode: String
    },
    certifications: [
      {
        name: String,
        issuedBy: String,
        validUntil: Date,
        certificateUrl: String
      }
    ],
    trustScore: {
      type: Number,
      default: 85,
      min: 0,
      max: 100
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

farmerProfileSchema.index({ location: '2dsphere' });
farmerProfileSchema.index({ 'address.district': 1, farmingPractice: 1 });

export const FarmerProfile = mongoose.model('FarmerProfile', farmerProfileSchema);
export default FarmerProfile;
