import mongoose from 'mongoose';

/**
 * UzhavanAuditLog Model
 * Level 4 Architecture Reference: Section 11 — AI Audit Log
 *
 * Immutable append-only audit trail for all AI-orchestrated operations.
 * Tracks user commands, detected intents, tool selections, authorization checks, and results.
 * NEVER stores API secrets or credentials.
 */
const uzhavanAuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    conversationId: {
      type: String,
      index: true
    },
    userCommand: {
      type: String,
      required: true,
      trim: true
    },
    language: {
      type: String,
      default: 'en'
    },
    detectedIntent: {
      type: String,
      default: 'UNKNOWN'
    },
    toolSelected: {
      type: String,
      default: null,
      index: true
    },
    toolArguments: {
      type: Object,
      default: {}
    },
    authorizationResult: {
      isAuthorized: { type: Boolean, required: true },
      userRole: String,
      requiredRole: String
    },
    executionResult: {
      type: Object,
      default: null
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'CONFIRMATION_PENDING', 'UNAUTHORIZED', 'CLARIFICATION_REQUIRED'],
      required: true,
      index: true
    },
    errorInfo: {
      type: String,
      default: null
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false } // Immutable audit record
  }
);

uzhavanAuditLogSchema.index({ userId: 1, createdAt: -1 });
uzhavanAuditLogSchema.index({ toolSelected: 1, status: 1 });

export const UzhavanAuditLog = mongoose.model('UzhavanAuditLog', uzhavanAuditLogSchema);
export default UzhavanAuditLog;
