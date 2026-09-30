import mongoose from 'mongoose';

/**
 * UzhavanConversation Model
 * Level 4 Architecture Reference: Section 1 & Section 10 — AI Conversation State
 *
 * Persists multi-turn context and pending intent sessions across turns.
 * Enables conversational interactions like:
 *   User: "Tomato add pannunga"
 *   Uzhavan: "How much quantity?"
 *   User: "500 kg" -> resumes pending createProduct draft.
 */
const uzhavanConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    language: {
      type: String,
      enum: ['en', 'ta', 'tanglish'],
      default: 'en'
    },
    messages: [
      {
        role: {
          type: String,
          enum: ['user', 'assistant', 'system', 'tool'],
          required: true
        },
        content: {
          type: String,
          required: true
        },
        toolCalls: Array,
        toolResult: Object,
        timestamp: {
          type: Date,
          default: Date.now
        }
      }
    ],
    // Multi-turn context state (e.g. half-filled form or pending clarification)
    contextData: {
      pendingIntent: { type: String, default: null },
      draftArgs: { type: Object, default: {} },
      lastActiveTool: { type: String, default: null }
    },
    // Sensitive actions pending user confirmation
    pendingConfirmation: {
      requiresConfirmation: { type: Boolean, default: false },
      toolName: { type: String, default: null },
      params: { type: Object, default: {} },
      confirmationPrompt: { type: String, default: null },
      expiresAt: { type: Date, default: null }
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

uzhavanConversationSchema.index({ userId: 1, updatedAt: -1 });

export const UzhavanConversation = mongoose.model('UzhavanConversation', uzhavanConversationSchema);
export default UzhavanConversation;
