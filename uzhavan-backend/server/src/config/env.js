import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env relative to server root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Validate required environment variables and return typed configuration object.
 * Implements Level 2 Fail-Fast Environment Validation.
 */
function validateConfig() {
  const criticalVars = [
    { key: 'PORT', default: 5000 },
    { key: 'NODE_ENV', default: 'development' },
    { key: 'MONGODB_URI', required: true },
    { key: 'JWT_SECRET', required: true },
    { key: 'CLIENT_URL', default: 'http://localhost:5173' }
  ];

  const missing = [];
  const config = {};

  for (const item of criticalVars) {
    const val = process.env[item.key] || item.default;
    if (item.required && (!val || val.trim() === '')) {
      missing.push(item.key);
    }
    config[item.key] = val;
  }

  if (missing.length > 0) {
    const errorMessage = `
======================================================================
[CONFIG CRITICAL ERROR] FAIL-FAST: Missing mandatory environment variables!
Missing variables: ${missing.join(', ')}
Please check server/.env or server/.env.example and provide valid values.
======================================================================`;
    console.error(errorMessage);
    process.exit(1);
  }

  // Parse integrations with graceful status detection
  config.PORT = parseInt(config.PORT, 10);
  config.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

  // Cloudinary status
  config.cloudinary = {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    isConfigured: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET &&
      !process.env.CLOUDINARY_CLOUD_NAME.includes('your_') &&
      !process.env.CLOUDINARY_CLOUD_NAME.includes('dev_cloud')
    )
  };

  // Map Provider abstraction (OSM-compatible / Leaflet frontend, backend geo-independent)
  config.mapProvider = {
    type: 'OSM-compatible / GeoJSON',
    isConfigured: true
  };

  // AI / Uzhavan Provider status
  const aiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || '';
  const aiProvider = process.env.AI_PROVIDER || (process.env.GROQ_API_KEY || aiKey.startsWith('gsk_') ? 'groq' : 'gemini');
  config.ai = {
    provider: aiProvider,
    apiKey: aiKey,
    model: process.env.AI_MODEL || (aiProvider === 'groq' ? 'qwen/qwen3.8-27b' : 'gemini-2.0-flash'),
    isConfigured: Boolean(
      aiKey &&
      !aiKey.includes('your_') &&
      !aiKey.includes('dev_')
    )
  };

  // Voice Providers status
  config.voice = {
    sttProvider: process.env.STT_PROVIDER || 'mock',
    ttsProvider: process.env.TTS_PROVIDER || 'mock',
    isSTTConfigured: process.env.STT_PROVIDER !== 'mock',
    isTTSConfigured: process.env.TTS_PROVIDER !== 'mock'
  };

  return Object.freeze(config);
}

export const env = validateConfig();
