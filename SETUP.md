# Uzhavan 360 — Local setup

**If your download includes `INCLUDED_ENV_README.md`, read that first.** That password-protected edition already contains your uploaded `uzhavan-backend/server/.env` and a matching `frontend/.env`. Do not overwrite them with the example templates below. Its configured ports may differ from the default examples in this general guide.

## 1. Prerequisites

- Node.js 20+ LTS (or Node.js 22 LTS) and npm.
- Yarn Classic 1.22.22 for the frontend (`npm install --global yarn@1.22.22` or npm).
- A running MongoDB instance or a MongoDB Atlas connection string.
- Zero Python dependencies required — 100% pure Node.js full-stack architecture.

Extract the ZIP first. Run all commands from the extracted `uzhavan-360` folder unless another folder is specified. Commands below use a Bash-compatible shell; on Windows you can copy files in Explorer and use separate terminals for the services.

## 2. Where to create `.env` files

Do not put one shared `.env` at the project root. Copy the included templates to these exact locations:

| File to create | Copy from | Purpose |
|---|---|---|
| `frontend/.env` | `frontend/.env.example` | Public browser configuration: backend origin only. |
| `uzhavan-backend/server/.env` | `uzhavan-backend/server/.env.example` | Database, JWT secret, Gemini/Groq key, and backend integrations. |
| `backend/.env` | `backend/.env.example` | Node.js API Gateway / Proxy configuration (`PORT=8001`). |

```bash
cp frontend/.env.example frontend/.env
cp uzhavan-backend/server/.env.example uzhavan-backend/server/.env
```

### Frontend: `frontend/.env`

The template points directly to the local Express server:

```dotenv
REACT_APP_BACKEND_URL=http://localhost:8030
PORT=3000
ENABLE_HEALTH_CHECK=false
DISABLE_EMERGENT_OVERLAY=true
```

`REACT_APP_BACKEND_URL` is the backend origin **without `/api`**; the current client appends `/api`. A legacy `REACT_APP_API_URL` override, if set elsewhere, takes precedence and must include `/api`; leave that override unset for this setup. Remove stale overrides from your own `.env.local` or shell if applicable.

Never put database credentials, JWT secrets, or Gemini keys in frontend environment variables. All `REACT_APP_*` values are public in the compiled browser bundle. Restart the frontend after changing its environment; rebuild if using a compiled build.

### Authoritative API: `uzhavan-backend/server/.env`

Set these before starting the API:

- `PORT=8030`
- `NODE_ENV=development`
- `CLIENT_URL=http://localhost:3000` — must exactly match the browser frontend origin for CORS.
- `MONGODB_URI` — your MongoDB connection string. The template uses `mongodb://127.0.0.1:27017/uzhavan360` for local development. Ensure MongoDB is running.
- `JWT_SECRET` — required; generate a new strong secret on your own computer:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste that generated value into `JWT_SECRET=`. Do not reuse a public example secret or share this file.

Additional settings:

- `JWT_EXPIRES_IN=7d`
- `AI_PROVIDER=gemini`
- `AI_API_KEY=` — put your Gemini API key here when ready. `GEMINI_API_KEY` is also supported, but `AI_API_KEY` takes precedence; only one needs a value. Restart the Express server after editing.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — leave blank unless configuring that service. Credentials alone do not create an upload route; the supplied API currently has no frontend upload endpoint, so use product image URLs.
- `STT_PROVIDER=mock` and `TTS_PROVIDER=mock` — backend voice providers are **MOCKED**, not live voice integrations. Browser speech support is separate and browser-dependent. Changing the provider labels alone does not verify or enable a working voice service.

## 3. Install and start the Express API

In terminal 1:

```bash
cd uzhavan-backend
npm ci
npm start
```

Install at `uzhavan-backend/`, not just `server/`: npm workspaces link the required `@uzhavan360/shared` package. Keep `server/`, `shared/`, and the root package files together.

The API has no separate transpilation/build step: `npm start` runs its JavaScript source. Visit `http://localhost:8030/api/health` to check service and database status. MongoDB is a separate service; this ZIP does not install or start it.

## 4. Install and start the frontend

In terminal 2, from the extracted project root:

```bash
cd frontend
yarn install --frozen-lockfile
yarn start
```

Open `http://localhost:3000`. The frontend calls the Express API directly in this local setup; you do **not** need Python or the proxy.

To create an optimized frontend build:

```bash
yarn build
```

This produces `frontend/build/`; environment values are embedded at build time. Use a web server with SPA history fallback when serving that build. Do not open its HTML directly with `file://`.

## 5. Accounts and optional development data

The ZIP contains source code, not the preview MongoDB database or private preview account credentials. With a fresh database, register new buyer/farmer accounts in the app.

For optional sample records in a **disposable development database only**:

```bash
cd uzhavan-backend
npm run seed
```

The existing repository seeder contains fixed demonstration credentials in `server/src/config/seed.js` and writes sample produce/inventory data. Do not use it with real users or a production database. Sample marketplace locations are around Coimbatore, Tamil Nadu; choose a nearby location while checking those records.

For your own local admin account, use the existing one-off backend script from `uzhavan-backend/server/` after supplying `ADMIN_PHONE`, `ADMIN_PASSWORD`, and optionally `ADMIN_NAME` privately in the environment (or in that server's `.env` file):

```bash
node src/config/seedAdmin.js
```

This script creates an admin or promotes and resets the password of an existing matching phone number. Choose a strong password and remove the one-off `ADMIN_*` values afterward. Do not use public registration to create administrators.

**Known security issue in the supplied backend:** public registration accepts `ROLE_ADMIN`. This is not fixed by hiding the role in the frontend. Resolve it in the authoritative API before exposing the application to untrusted users. No auth/business-rule changes were made for this export.

## 6. Node.js API Gateway / Proxy Server
 
`backend/server.js` provides a high-performance Node.js API gateway. It forwards client requests to the authoritative Express API without adding any overhead or requiring Python.

To run the Node.js API gateway locally:

```bash
cp backend/.env.example backend/.env
cd backend
node server.js
```

Or using npm:

```bash
cd backend
npm start
```

Runs on `http://localhost:8001` and forwards requests to `UZHAVAN_API_UPSTREAM` (`http://127.0.0.1:8030`). To run tests:

```bash
cd backend
npm test
```

## 7. What is verified and what still needs testing

Verified on 2026-09-30:

- `npm run build` (frontend): compiled successfully.
- All Node source and backend files: syntax checks passed.
- Node.js API test suites (`backend/tests/api.test.js` & `uzhavan-backend/server/tests`): passed.
- Current API health: healthy, MongoDB connected.

Not yet verified: a fresh installation on your computer, full buyer/farmer/admin end-to-end workflows, inventory/order concurrency, and the AI success/confirmation flow. You chose to run functional tests yourself; a successful build is not proof those workflows are complete.

Known limits in the supplied backend:

- Gemini is currently unconfigured; configure your backend key to test AI. Do not call Gemini directly from the frontend.
- No Socket.IO implementation; frontend polling/refetch is the fallback, not realtime push.
- No frontend image-upload route, review endpoints, or byproduct request/order transaction flow.
- Backend voice providers are **MOCKED**.
- Public admin-role registration issue described above requires a backend fix.

## 8. Archive contents

Included: frontend source/public assets, authoritative Express and shared source, optional proxy, package manifests/lockfiles, source tests, documentation, and secret-free environment templates.

Excluded intentionally: actual `.env`/`.env.local` files, account credential notes, private keys, database contents, `node_modules`, Python virtual environments/caches, generated build output, logs, test-result artifacts, Git history, and platform metadata. Install dependencies with the commands above. No secrets need to be copied from the preview environment.