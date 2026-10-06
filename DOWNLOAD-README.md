# Tri-State Systems Manager — Downloadable System

**Version:** release tarball built 2026-09-25 from `main` (see filename for commit).
**License:** Apache-2.0. **Governing axiom:** Technology informs people; it does
not silently govern people. Human authority remains final.

## What's inside

- `tsm-console/` — the web application (React 19 + TypeScript + Vite +
  MapLibre + Three.js). **`tsm-console/dist/` is the prebuilt production
  bundle** — serve it statically to run the UI with no build step.
- `tsm-console/ios/` — Capacitor iOS native project (Swift service
  `TSMMapDataFabricService.swift` + `TSMDataFabricPlugin.swift` bridge).
  Source form; needs macOS/Xcode to compile (see below).
- `tsm-console/server/` — Node ingestion + engineering services (FEMA NFHL,
  USGS, NOAA/NWS, Indiana GIS, USACE, HEC-RAS worker, evidence signing).
- `backend/` — Python services (hydrology datum rule, HEC-RAS worker/HDF5,
  no-rise comparator, geotech solver, OpenMI transport, governance).
- `native/archimedes/` — real 1D Saint-Venant C++ solver (CMake/CTest).
- `tools/` — LOMA/FIRMette generators, terrain DEM merge job, geospatial tools.
- `db/migrations/`, `ops/postgis/` — PostGIS schema and operations.
- `data/schemas/` — versioned JSON contracts (tile fabric, evidence artifacts,
  HEC-RAS, pipeline, model cards) each with a minimal valid example in
  `data/schemas/examples/`; see `data/schemas/README.md` + `CHANGELOG.md`.
- `docs/` — full documentation, including:
  - `docs/BUILD-IOS.md` — iOS build/runbook
  - `docs/OWNER-ACTION-REQUIRED.md` — **read this**: everything that needs
    the owner (survey coordinates, FEMA IDs, grant deadlines, Mac build, …)
  - `docs/ROADMAP-BUILD-2026-09-25.md` — the 7 newly built modeling modules
  - `docs/EXECUTIVE-REVIEW-VERIFICATION.md` (repo root) — independent verification report

## Quick start (web app)

```bash
cd tsm-console
npm ci            # strict, reproducible install
npm run build     # production bundle -> dist/
npm run preview   # serve the production build locally
```

Or serve the included `tsm-console/dist/` directly with any static server.

## Tests

```bash
cd tsm-console
npm run test:all   # node --test suites (200) + vitest (148)
npm run check:type # tsc --noEmit
cd ..
python3 -m pytest backend/tests/test_hec_ras_hdf_pipeline.py \
  tools/loma/tests/test_firmette.py tools/terrain/tests/test_merge_dem.py
```

All green at packaging time (see `build-logs/final-system.log`, not shipped).

## iOS app (needs a Mac)

1. Mac with Xcode 16+, Apple Developer Program membership.
2. Register bundle id `org.tristate.tsm.ios`; create distribution cert +
   provisioning profile; add signing secrets per `.github/workflows/ios-build.yml`.
3. `cd tsm-console && npx cap sync ios`, then archive in Xcode or run the
   macOS workflow. Full steps: `docs/BUILD-IOS.md`.
4. The Swift service/plugin are **not compiled** in this archive (no Xcode here);
   placeholder icons should be replaced before release.

## What this archive does NOT include / still needs

- **GitHub push**: local `main` is ahead of the remote; needs the owner's
  GitHub authentication (`git push` when ready).
- **Owner data** (`docs/OWNER-ACTION-REQUIRED.md`): certified survey
  coordinates (~6.4 km discrepancy between sources), FEMA Community ID /
  FIRM panel reconciliation, HEC-RAS executable + model packages, gage-zero
  NAVD88 conversions, reportlab/GDAL for live FIRMette-PDF and DEM-fetch
  paths (implemented, dry-run tested only).
- **Grants**: INDOT CCMG FY2027 closes **2026-09-30**; BRIC/FMA rounds closed —
  see `docs/grants/POSEY-2026-STATE-GRANT-CALENDAR.md`.
- `node_modules/`, `.git/`, and logs are intentionally excluded; run
  `npm ci` to restore dependencies.

## Honesty notes

Models are screening-level unless labeled otherwise: SCS runoff is lumped
(validate vs USGS benchmarks before operational use); Hazus curves are
Hazus-*compatible*, not FEMA-certified; the 2D inundation model is
diffusion-wave (not full Saint-Venant); FIRMette outputs are drafts requiring
human review. Missing data fails closed to `UNAVAILABLE` — never fabricated.
