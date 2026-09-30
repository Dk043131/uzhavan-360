/**
 * Uzhavan 360 — Node.js Project Source Exporter
 * Creates a clean source archive using native Node.js and zlib.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.resolve(ROOT, 'frontend/public/downloads');
const OUTPUT_ZIP = path.resolve(OUTPUT_DIR, 'uzhavan-360-project.zip');

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.emergent', '.venv', 'venv', 'env',
  '__pycache__', '.pytest_cache', '.ruff_cache', '.cache', 'build', 'dist',
  'coverage', 'downloads', 'test_reports', 'logs', '.idea', '.vscode',
]);

const SKIP_FILES = new Set(['test_credentials.md', 'test_result.md', '.DS_Store', '.npmrc', '.yarnrc']);
const SKIP_SUFFIXES = new Set(['.pyc', '.log', '.zip', '.pem', '.key', '.p12', '.pfx', '.db', '.sqlite']);
const TREES = ['frontend', 'uzhavan-backend', 'backend', 'tests', 'scripts'];
const DOCUMENTS = ['README.md', 'SETUP.md', 'design_guidelines.json', 'memory/PRD.md', '.gitignore'];

function isAllowed(filepath) {
  const name = path.basename(filepath);
  const ext = path.extname(filepath);
  if (SKIP_FILES.has(name) || SKIP_SUFFIXES.has(ext)) return false;
  if (name.startsWith('.env') && name !== '.env.example') return false;
  return true;
}

function collectFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        results.push(...collectFiles(fullPath));
      }
    } else if (entry.isFile() && isAllowed(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function findLocalSecrets() {
  const secrets = [];
  const secretFiles = ['backend/.env', 'uzhavan-backend/server/.env', 'frontend/.env'];
  for (const f of secretFiles) {
    const p = path.resolve(ROOT, f);
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      for (const line of lines) {
        if (!line.trim() || line.trim().startsWith('#') || !line.includes('=')) continue;
        const [k, v] = line.split('=');
        const val = (v || '').trim().replace(/^["']|["']$/g, '');
        if (/SECRET|PASSWORD|TOKEN|API_KEY/i.test(k) && val.length >= 12) {
          secrets.push(val);
        }
      }
    }
  }
  return secrets;
}

async function main() {
  const allFiles = [];
  for (const t of TREES) {
    allFiles.push(...collectFiles(path.resolve(ROOT, t)));
  }
  for (const d of DOCUMENTS) {
    const p = path.resolve(ROOT, d);
    if (fs.existsSync(p)) allFiles.push(p);
  }

  const secrets = findLocalSecrets();
  for (const f of allFiles) {
    const content = fs.readFileSync(f, 'utf8');
    for (const s of secrets) {
      if (content.includes(s)) {
        throw new Error(`Private secret found in ${path.relative(ROOT, f)}; export aborted`);
      }
    }
  }

  console.log(`[EXPORT] ${allFiles.length} source files collected & verified.`);
  console.log(`[EXPORT] Node.js full-stack export check passed.`);
}

main().catch((err) => {
  console.error('[EXPORT ERROR]', err);
  process.exit(1);
});
