import * as uzhavanService from './uzhavan.service.js';
import { UzhavanConversation } from './uzhavanConversation.model.js';
import { UzhavanAuditLog } from './uzhavanAuditLog.model.js';
import { sendSuccess } from '../../utils/response.js';
import { env } from '../../config/env.js';

/**
 * POST /api/uzhavan/message
 * Main entry: process text or transcribed voice input through Gemini.
 */
export async function sendMessage(req, res, next) {
  try {
    const { text, language, conversationId } = req.body;
    const result = await uzhavanService.processUserMessage({
      text,
      userContext: req.user,
      language: language || 'en',
      conversationId
    });
    return sendSuccess(res, result, 'Uzhavan response');
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/uzhavan/tool
 * Direct tool dispatch — used when intent is explicitly known from UI.
 */
export async function dispatchTool(req, res, next) {
  try {
    const { toolName, params, confirmationGiven } = req.body;
    const result = await uzhavanService.dispatchTool({
      toolName,
      userContext: req.user,
      params: params || {},
      confirmationGiven: Boolean(confirmationGiven)
    });
    return sendSuccess(res, result, 'Tool executed');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/uzhavan
 * Public tool registry status — no auth required.
 */
export async function getStatus(req, res, next) {
  try {
    const registry = uzhavanService.getToolRegistry();
    return sendSuccess(res, {
      status: 'tool_layer_active',
      totalTools: registry.length,
      tools: registry,
      aiProvider: env.ai.provider,
      aiModel: env.ai.model,
      aiConfigured: env.ai.isConfigured,
      nlpStatus: env.ai.isConfigured
        ? `${env.ai.provider === 'groq' ? `Groq (${env.ai.model})` : 'Gemini'} function-calling active`
        : 'Set GROQ_API_KEY or GEMINI_API_KEY to enable AI processing'
    }, 'ROOT AI layer is active');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/uzhavan/conversations
 * Get the user's conversation history list.
 */
export async function getConversations(req, res, next) {
  try {
    const conversations = await UzhavanConversation.find({ userId: req.user.id })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select('conversationId language createdAt updatedAt messages contextData');

    return sendSuccess(res, conversations, 'Conversation history');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/uzhavan/conversations/:conversationId
 * Get a specific conversation thread.
 */
export async function getConversation(req, res, next) {
  try {
    const conv = await UzhavanConversation.findOne({
      conversationId: req.params.conversationId,
      userId: req.user.id
    });

    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    return sendSuccess(res, conv, 'Conversation');
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/uzhavan/audit-log
 * Get the AI audit trail for the current user (admin + own user).
 */
export async function getAuditLog(req, res, next) {
  try {
    const filter = { userId: req.user.id };
    const logs = await UzhavanAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-__v');

    return sendSuccess(res, logs, 'AI audit log');
  } catch (err) {
    next(err);
  }
}
