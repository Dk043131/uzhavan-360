import express from 'express';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { sendSuccess } from '../../utils/response.js';

const router = express.Router();

/**
 * GET /api/health (and /health)
 * Platform health check — returns service status and integration availability.
 * Level 2 Setup Reference: Section 6 & 25
 */
router.get('/', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const integrationStatus = {
    database: {
      status: isDbConnected ? 'connected' : 'disconnected',
      note: isDbConnected ? 'Database connection active' : 'Database connection not ready'
    },
    cloudinary: {
      status: env.cloudinary.isConfigured ? 'configured' : 'unconfigured',
      note: env.cloudinary.isConfigured
        ? 'Image upload service ready'
        : 'Set CLOUDINARY_* env vars to enable image uploads'
    },
    mapProvider: {
      status: 'ready',
      type: 'OSM-derived / Leaflet (Abstract)',
      note: 'Replaceable map-provider architecture active (no Google Maps dependency)'
    },
    ai: {
      provider: env.ai.provider,
      status: env.ai.isConfigured ? 'configured' : 'unconfigured',
      note: env.ai.isConfigured
        ? `Uzhavan AI provider "${env.ai.provider}" ready`
        : 'Set AI_API_KEY to enable Uzhavan AI assistant'
    },
    voice: {
      stt: env.voice.sttProvider,
      tts: env.voice.ttsProvider,
      status: (env.voice.isSTTConfigured && env.voice.isTTSConfigured) ? 'configured' : 'mock/dev',
      note: 'Set STT_PROVIDER and TTS_PROVIDER to enable live voice'
    }
  };

  return sendSuccess(res, {
    status: 'HEALTHY',
    service: 'Uzhavan 360 API',
    version: '1.0.0',
    environment: env.NODE_ENV,
    uptime: `${Math.floor(process.uptime())}s`,
    integrations: integrationStatus
  }, 'Uzhavan 360 API is running');
});

export default router;
