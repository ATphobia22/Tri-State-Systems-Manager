# GitHub Pages build/deploy repair

Date: 2026-10-14
Repository: ATphobia22/Tri-State-Systems-Manager

## Changes applied

- Added `pull_request` validation for PRs targeting `main`; pull requests build and test but never deploy.
- Pages deployment runs on `main` pushes and manual dispatches when `TSM_PAGES_ENABLED != false` (opt-out).
- Live API requirements separated: `TSM_REQUIRE_LIVE_API=true` makes `TSM_API_BASE_URL` mandatory and HTTPS-only; otherwise static console builds without API.
- Configurable `VITE_PAGES_BASE_PATH` validation (must start and end with `/`). Default remains `/Tri-State-Systems-Manager/`.
- Pinned Node `22.16.0` and npm major.minor `10.9` with runtime assertion.
- SPA `404.html` generated on every build (including PRs) so artifact gates remain valid.
- `npm ci` without lockfile mutation/diff step.
- **CRITICAL:** full workflow body restored after a truncated intermediate push; all IGIO acquire, 3D tile validation, and post-deploy 22,815 feature checks retained.

## Building 3D inventory (committed)

See `data/buildings/GLB-SUBSET-INVENTORY.md`.

## Verification

- Full green `npm ci` / Vite build requires GitHub Actions network runners.
- Post-deploy curl asserts 22,815 features + `height_m` on published `buildings-3d.json`.
