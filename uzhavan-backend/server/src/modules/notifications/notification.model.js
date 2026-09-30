import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: [
        'REQUEST_RECEIVED',
        'REQUEST_ACCEPTED',
        'REQUEST_REJECTED',
        'QUANTITY_REQUIRED',
        'ORDER_RESERVED',
        'ORDER_PREPARING',
        'ORDER_READY',
        'ORDER_COMPLETED',
        'ORDER_NO_SHOW',
        'ORDER_CANCELLED',
        'ORDER_EXPIRED',
        'DEMAND_ALERT',
        'BYPRODUCT_MATCH',
        'SYSTEM_ALERT'
      ]
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    data: {
      type: Object,
      default: {}
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
