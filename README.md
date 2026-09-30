# Uzhavan 360

React marketplace frontend connected to the authoritative Uzhavan 360 Express/MongoDB backend. Includes buyer, farmer, admin, and backend-mediated AI interfaces.

**Start with [SETUP.md](./SETUP.md)** for environment file locations, installation, startup commands, optional development seed data, and current limitations.

## Project layout

- `frontend/`: React application, API client, TanStack Query, and role-oriented pages.
- `uzhavan-backend/server/`: authoritative Express API and business logic.
- `uzhavan-backend/shared/`: backend workspace dependency; keep it alongside `server/`.
- `backend/`: Node.js server and API gateway entry point (`server.js`).
- `memory/PRD.md`: project status and remaining verification work.

## Verification status — 2026-09-30

- Frontend optimized production build: passed.
- Node.js backend & API test suites: passed.
- Express API health: healthy; database connected.
- End-to-end buyer/farmer/admin testing: not completed; user elected to test independently.
- AI is unconfigured until a backend API key is supplied. Backend voice providers are **MOCKED**.

The standard source archive excludes private `.env` files, local credentials, database contents, installed dependencies, generated builds, runtime logs, test reports, and Git/platform metadata. Secret-free `.env.example` files are included. A separately requested password-protected edition includes the user's uploaded backend environment file; see its `INCLUDED_ENV_README.md` before setup. The optional repository seeder contains fixed demo credentials: use it only with a disposable development database.

The supplied Uzhavan 360 logo is included in `frontend/public/brand/`, displayed in navigation and login/registration, and used for browser/app icons. The original JPEG is preserved alongside optimized versions.
