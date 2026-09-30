import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, ALL_ROLES } from '@uzhavan360/shared';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      match: [/\S+@\S+\.\S+/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      default: ROLES.BUYER
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    // Farmer specific details
    farmDetails: {
      farmName: { type: String, trim: true },
      bio: { type: String, trim: true },
      location: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          default: [76.9558, 11.0168]
        }
      },
      address: {
        village: String,
        district: String,
        state: { type: String, default: 'Tamil Nadu' },
        pincode: String
      }
    },
    // Buyer specific details
    buyerDetails: {
      businessType: {
        type: String,
        enum: ['RETAIL', 'WHOLESALE', 'RESTAURANT', 'HOUSEHOLD', 'PROCESSOR', 'OTHER'],
        default: 'HOUSEHOLD'
      },
      noShowCount: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true
  }
);

// Geospatial index for nearby discovery
userSchema.index({ 'farmDetails.location': '2dsphere' });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);
export default User;
