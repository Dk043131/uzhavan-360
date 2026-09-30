/**
 * Uzhavan 360 — Server Entry Point
 * Level 1 Architecture Reference: Section 29 - Backend Architecture
 */

import { env } from './config/env.js';  // Validate env FIRST — fail-fast
import { connectDB, disconnectDB } from './config/db.js';
import app from './api/app.js';

const PORT = env.PORT;

async function startServer() {
  console.log(`\n====================================================`);
  console.log(`  UZHAVAN 360 API — Connecting Farms, Nourishing Lives`);
  console.log(`  Environment : ${env.NODE_ENV}`);
  console.log(`  Port        : ${PORT}`);
  console.log(`====================================================\n`);

  // Connect to MongoDB — non-fatal in dev, fatal in prod
  await connectDB();

  // Report integration availability
  if (!env.cloudinary.isConfigured) {
    console.warn('[CONFIG] Cloudinary: UNCONFIGURED (image uploads unavailable until CLOUDINARY_* env vars are set)');
  }
  if (!env.ai.isConfigured) {
    console.warn(`[CONFIG] Uzhavan AI (${env.ai.provider}): UNCONFIGURED (set AI_API_KEY to enable voice assistant)`);
  }
  if (!env.voice.isSTTConfigured) {
    console.warn('[CONFIG] STT Voice: Using MOCK provider (set STT_PROVIDER for live speech recognition)');
  }
  if (!env.voice.isTTSConfigured) {
    console.warn('[CONFIG] TTS Voice: Using MOCK provider (set TTS_PROVIDER for live speech synthesis)');
  }

  const server = app.listen(PORT, () => {
    console.log(`\n[SERVER] Uzhavan 360 API is running at http://localhost:${PORT}/api`);
    console.log(`[SERVER] Health check: http://localhost:${PORT}/api/health\n`);
  });

  // ── Scheduled Workers ───────────────────────────────────────────────────────
  // Periodically check and expire stale reservations (12h TTL)
  const EXPIRY_INTERVAL_MS = 60 * 1000; // 60 seconds
  const expiryTimer = setInterval(async () => {
    try {
      const { checkAndExpireReservations } = await import('./modules/orders/orders.service.js');
      const expired = await checkAndExpireReservations();
      if (expired && expired.length > 0) {
        console.log(`[WORKER] Auto-expired ${expired.length} stale order reservation(s).`);
      }
    } catch (err) {
      console.error('[WORKER ERROR] checkAndExpireReservations failed:', err.message);
    }
  }, EXPIRY_INTERVAL_MS);

  // ── Graceful Shutdown ──────────────────────────────────────────────────────
  async function shutdown(signal) {
    console.log(`\n[SERVER] Received ${signal}. Shutting down gracefully...`);
    clearInterval(expiryTimer);
    server.close(async () => {
      await disconnectDB();
      console.log('[SERVER] HTTP server closed. Goodbye.');
      process.exit(0);
    });

    // Force shutdown after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('[SERVER] Forcing shutdown after timeout.');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Catch unhandled rejections — log and attempt graceful shutdown in production
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION]', reason);
    if (env.NODE_ENV === 'production') {
      shutdown('unhandledRejection');
    }
  });
}

startServer();
