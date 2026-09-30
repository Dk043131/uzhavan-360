/**
 * Uzhavan 360 — Node.js Server & API Gateway
 * Replaces the legacy Python FastAPI proxy with a native, high-performance Node.js service.
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Environment Resolution ───────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '.env');

if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // Fallback to manual parsing if already partially loaded
    }
  }
  // Ensure all keys are populated
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

const PORT = parseInt(process.env.PORT || '8001', 10);
const UPSTREAM = (process.env.UZHAVAN_API_UPSTREAM || 'http://127.0.0.1:8030').replace(/\/$/, '');
const HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'content-length',
]);

const upstreamUrl = new URL(UPSTREAM);
const transport = upstreamUrl.protocol === 'https:' ? https : http;

// ── HTTP Gateway Server ──────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Construct upstream target URL
  const target = new URL(req.url, UPSTREAM);

  // Filter hop-by-hop headers
  const forwardHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_HEADERS.has(key.toLowerCase()) && key.toLowerCase() !== 'host') {
      forwardHeaders[key] = value;
    }
  }

  forwardHeaders['host'] = upstreamUrl.host;
  forwardHeaders['x-forwarded-host'] = req.headers['host'] || '';
  forwardHeaders['x-forwarded-proto'] = req.socket.encrypted ? 'https' : 'http';
  forwardHeaders['x-forwarded-for'] = [
    req.headers['x-forwarded-for'],
    req.socket.remoteAddress,
  ].filter(Boolean).join(', ');

  const options = {
    protocol: upstreamUrl.protocol,
    hostname: upstreamUrl.hostname,
    port: upstreamUrl.port || (upstreamUrl.protocol === 'https:' ? 443 : 80),
    path: target.pathname + target.search,
    method: req.method,
    headers: forwardHeaders,
    timeout: 60000,
  };

  const proxyReq = transport.request(options, (upstreamRes) => {
    const responseHeaders = {};
    for (const [key, value] of Object.entries(upstreamRes.headers)) {
      if (!HOP_HEADERS.has(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    }

    res.writeHead(upstreamRes.statusCode || 200, responseHeaders);
    upstreamRes.pipe(res);
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Gateway timeout: upstream Uzhavan 360 API did not respond in time.',
      }));
    }
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Uzhavan 360 API is unreachable. Please ensure the Express server is running on port 8030.',
        code: err.code || 'UPSTREAM_UNREACHABLE',
      }));
    }
  });

  // Stream client request body to upstream
  req.pipe(proxyReq);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  UZHAVAN 360 — Node.js Server & API Gateway`);
  console.log(`  Runtime  : Node.js ${process.version}`);
  console.log(`  Listening: http://0.0.0.0:${PORT}`);
  console.log(`  Upstream : ${UPSTREAM}`);
  console.log(`====================================================`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n[GATEWAY] Received ${signal}. Shutting down Node.js server...`);
  server.close(() => {
    console.log('[GATEWAY] Closed all connections.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
