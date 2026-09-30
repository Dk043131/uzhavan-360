# Uzhavan 360 Product Requirements

## Original goal and governing scope
Build a mobile-first farm-produce marketplace frontend, then connect it end-to-end to the supplied authoritative Uzhavan 360 Node/Express backend. The master integration request supersedes the initial frontend-only shell scope. Preserve the visual direction, role-aware buyer/farmer/admin experience, and backend ownership of auth, RBAC, inventory, orders, notifications, AI, persistence, and business rules.

No fake frontend data/success states, duplicate business logic, frontend MongoDB access, or direct Gemini calls. Ask before meaningful backend security/business-rule changes. Uzhavan AI must use backend conversation IDs, tools, and confirmation barriers.

## Latest user request — 2026-09-30
User will perform functional testing independently and requests a ZIP of the entire project plus instructions for `.env` files and other setup. Subsequently supplied a logo and backend `.env`, and explicitly requested including that `.env` inside the downloadable ZIP. Preserve runtime preview configuration; deliver this sensitive export encrypted. Do not claim full E2E completion.

## Architecture
- `frontend/`: React 19, React Router, TanStack Query, Leaflet, shared application layout, API client under `src/lib/api/`, auth context, and role-oriented routes.
- `uzhavan-backend/server/`: supplied authoritative Express/MongoDB modular monolith; `uzhavan-backend/shared/` is its npm workspace dependency.
- User approved local Express execution, MongoDB, generated local JWT secret, and one-off backend-model admin seeding.
- `backend/server.py`: explicitly approved transport-only FastAPI proxy to the Express API; no separate business logic.
- Preview: frontend 3000, proxy 8001, Express 8030. Port 8010 is occupied; do not reuse it.
- Protected preview settings remain unchanged. The frontend reads `REACT_APP_BACKEND_URL` and appends `/api`; a pre-existing `REACT_APP_API_URL` override remains supported by the current client.
- Local exported setup can connect frontend directly to Express, without the optional proxy.

## Implemented before export; functional coverage not fully verified
- Central API client, query layer, auth/session UI, protected routes, layout, location picker, and request/error states.
- Marketplace, product detail, farmer profile, list/map presentation, buyer requests/orders, notifications, profile, and byproducts.
- Farmer overview, products, inventory, requests, orders, and insights interfaces.
- Admin overview/users and Uzhavan assistant/history interfaces, browser speech capability support.
- Running local backend/proxy with seeded database and limited login/data/browser smoke checks from the preceding session.

## Export/documentation update — 2026-09-30
- Replaced outdated frontend-only README; added `SETUP.md` with exact environment file paths, installation/start commands, database requirements, optional seed/admin instructions, and limitations.
- Added secret-free templates at `frontend/.env.example`, `backend/.env.example`, and `uzhavan-backend/server/.env.example`; actual environment files and auth credentials unchanged.
- Source ZIP target: `frontend/public/downloads/uzhavan-360-project.zip`.
- Include frontend, authoritative backend/shared code, optional proxy, source tests, lockfiles, and docs.
- Exclude private environment files/credential notes, databases, dependencies, generated builds, logs/reports, Git and platform metadata.
- Existing repository development seed contains fixed demo credentials; documented as disposable-development-only, not removed or changed.

## Verification evidence — 2026-09-30
- Frontend `yarn build`: production compilation succeeded.
- Node syntax: 90 source/shared JavaScript files passed `node --check`.
- Python proxy syntax: passed.
- External preview `/api/health`: healthy and MongoDB connected; Gemini/Cloudinary unconfigured, backend voice mock/dev.
- Source export: 220 files; ZIP CRC and per-file SHA-256 checks passed, all three templates included, private environment values excluded. External download fetched successfully and matched the local archive hash. Reusable export command: `python scripts/export_project.py`.
- Full cross-role E2E testing has NOT been completed. User explicitly elected to test independently.
- Fresh installation outside the preview environment has not been validated.

## Configuration and confirmed gaps
- Backend secrets belong only in `uzhavan-backend/server/.env`: `MONGODB_URI`, fresh `JWT_SECRET`, and Gemini `AI_API_KEY` (or `GEMINI_API_KEY`). AI success paths remain blocked until configured.
- No Socket.IO implementation: polling/refetch fallback only.
- No image-upload endpoint: product image URLs only, even if Cloudinary credentials are configured.
- No review endpoints or byproduct transactional request/order flow.
- Backend STT/TTS providers are **MOCKED**; browser speech is separate.
- Supplied public registration accepts `ROLE_ADMIN`: known unresolved security gap, requires authorized backend fix before public use.

## Logo and user-configured archive — 2026-09-30
- Added the supplied logo to the shared header and login/registration visual, favicon, Apple touch icon, and app manifest. Original JPEG retained; optimized derivatives preserve the complete image.
- Updated app title/description; added responsive brand sizing and unique logo test IDs. No authentication or business logic changed.
- Fresh optimized frontend build passed; browser smoke check confirmed loaded header/login logos, title, and no desktop horizontal overflow.
- User-uploaded `.env` is staged privately outside app/public paths, not applied to running services. No preview database/JWT/port settings changed, and no external database or AI calls were made with uploaded credentials.
- Encrypted archive target: `frontend/public/downloads/uzhavan-360-with-env-and-logo.zip` (AES-256; requires 7-Zip, WinRAR, or Keka). Password stored privately outside project source and shared only in the completion message.
- Archive includes the uploaded backend `.env` unchanged at `uzhavan-backend/server/.env`, plus a frontend `.env` pointing to localhost API port 5000 and frontend port 5173, matching the supplied backend's public settings.
- Archive includes `INCLUDED_ENV_README.md`; it warns not to overwrite supplied env files, explains port differences, dependency installation, and credentials handling.
- Uploaded credentials are not independently validated. Uploaded JWT secret appears development/example-like; recommend replacing it before real use. The original upload was public: recommend rotating any live credentials it contains.
- Build/browser/archive checks are narrow; full E2E testing is still left to the user. Backend voice remains **MOCKED**.
- Encrypted export verified: 232 entries, AES-256 protection on every entry, missing/incorrect passwords rejected, all decrypted files matched their sources, and uploaded backend `.env` matched byte-for-byte. Public download SHA-256 matched local archive. Favicon, app icons, and manifest returned successfully.

## Prioritized backlog / next actions
- P0: User tests buyer/farmer/admin workflows, inventory/order transitions, notifications, permissions, and error states; address reproducible findings.
- P0: Obtain approval to fix public admin-role registration in the authoritative API before exposing to untrusted users.
- P1: User adds backend Gemini key; validate multi-turn conversation IDs, tool access, mutation confirmations, and truthful failures.
- P1: Complete API compatibility documentation, responsive checks, test-ID coverage, and mutation invalidation review.
- P2: Backend-supported uploads, reviews, byproduct transactions, and realtime, only after scope approval.
- Potential enhancement: saved marketplace filters for repeat buyers, after core flow verification.