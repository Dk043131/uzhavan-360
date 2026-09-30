import express from 'express';
import * as uzhavanController from './uzhavan.controller.js';
import { authenticate } from '../../middlewares/auth.js';

const router = express.Router();

// Public: Status and tool registry
router.get('/', uzhavanController.getStatus);

// Public: Studio-grade Neural TTS Voice endpoint
router.post('/tts', uzhavanController.textToSpeech);
router.get('/tts', uzhavanController.textToSpeech);

// Authenticated routes
router.use(authenticate);

// Core AI interaction
router.post('/message', uzhavanController.sendMessage);
router.post('/tool', uzhavanController.dispatchTool);

// Conversation management
router.get('/conversations', uzhavanController.getConversations);
router.get('/conversations/:conversationId', uzhavanController.getConversation);

// Audit log
router.get('/audit-log', uzhavanController.getAuditLog);

export default router;
