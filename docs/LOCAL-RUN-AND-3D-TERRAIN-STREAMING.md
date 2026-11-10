# Local run + 3D terrain streaming architecture

## How to run locally

### Prerequisites
- **Node.js 22** and **npm 10.9.x** (matches engineering gate)
- Git
- Optional: Python 3.11+ for terrain tile build scripts
- Optional: Docker for PostGIS/Martin tiles profile

### Console (web twin)

```bash
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager.git
cd Tri-State-Systems-Manager

# Install (lockfile authoritative)
npm ci
# If workspaces require console-local install:
cd tsm-console && npm ci && cd ..

# Wire new experience routes if not yet on your branch tip
node scripts/native/wire-experience-routes.mjs

# Dev server
cd tsm-console
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/` with Pages base `/Tri-State-Systems-Manager/` depending on config).

**Key routes**

| Path | What |
|------|------|
| `/` | Memorial / home |
| `/twin` · `/map` · `/cinematic` | Existing twin / map / cinema |
| `/cinematic-engineering` | Full cinematic engineering experience |
| `/workspaces` | Six-workspace shell |
| `/experience/living-river` | Living River Valley |
| `/experience/scenario-sandbox` | Scenario sandbox |
| `/experience/evidence-storyboard` | Evidence storyboard |
| `/flood-sim` | Flood simulator |

Optional API proxy (OIDC / ledger):

```bash
cd tsm-console && npm run dev:proxy
# or npm run dev:all
```

### Checks

```bash
npm run typecheck   # from repo root if configured
npm test
node scripts/native/windows-cinematic-release-test.mjs
```

### Native Unreal (Windows)

1. Follow `docs/release/UE58-ONE-SHOT-SHIPPING-RUNBOOK-2026-11-10.md`
2. Stage TSMData (Drive manifest / `scripts/native/stage-native-data*.mjs`)
3. Watch **TSM Native** GitHub Actions for `package-windows`
4. Independent check: `node scripts/native/windows-cinematic-release-test.mjs` with `TSM_SHIPPING_EXE` set to the built binary

---

## 3D terrain streaming — explained

TSM does **not** ship full LAS/LAZ in Git. Terrain is streamed or staged as **derived tiles** with provenance.

### Pipeline (operator → pixels)

```
USGS 3DEP / National Map (source DEM)
        │
        ▼
Acquire + hash + record CRS/vertical datum   (docs/3DEP-DATA-OPERATIONS.md)
        │
        ▼
Resample / encode Terrain-RGB or heightmap tiles
  (e.g. Terrarium-style PNG, or quantized-mesh / 3D Tiles terrain)
        │
        ▼
Host: GitHub Pages static XYZ  OR  Martin/PostGIS  OR  native staged TSMData
        │
        ▼
Client decoder (MapLibre terrain · Cesium terrain · UE landscape/World Partition)
        │
        ▼
Screen overlay: NFHL (REGULATORY), stage (OBSERVATION / GAGE_DATUM), scenarios (MODEL)
```

### Authority labels

| Layer | Authority |
|-------|-----------|
| Effective FIRM / NFHL | REGULATORY |
| NWPS/USGS stage | OBSERVATION (GAGE_DATUM until product zero applied) |
| 3DEP Terrain-RGB / screening DEM | **DERIVED** — not survey LAG |
| Cinema / camera paths | PRESENTATION |
| Scenario WSE / freeboard tools | MODEL_SIMULATION |

### Math at the surface

- Terrain-RGB / Terrarium encodes height in RGB channels; client reconstructs meters, then display units.
- Engineering freeboard still uses **explicit** LAG/BFE in one vertical datum — never silent “pixel = NAVD88 survey.”
- MTVI3: `WSE_NAVD88 = stage_ft + 318.59` only for that station’s published zero.

---

## Architecture diagram (streaming)

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Public / Operator Clients                     │
│  MapLibre (web)   Cesium (opt)   UE5.8 World Partition (native) │
└─────────────┬───────────────────┬───────────────────┬───────────┘
              │                   │                   │
     XYZ / PMTiles         3D Tiles / Ion        Staged TSMData
     Terrain-RGB            buildings              tileset://
              │                   │                   │
┌─────────────▼───────────────────▼───────────────────▼───────────┐
│                    Tile / Asset distribution                      │
│  GitHub Pages · Martin · object storage · private Drive snapshot  │
└─────────────┬───────────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────────┐
│                 Build & provenance plane                          │
│  scripts/geospatial · build-terrain-3d-tiles · manifests/SHA-256 │
│  CRS/datum recorded · DERIVED tag · no silent transforms         │
└─────────────┬───────────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────────┐
│              Authoritative acquisition (not in Git as LAS)        │
│         USGS 3DEP · National Map · (optional) QL metadata         │
└─────────────────────────────────────────────────────────────────┘
```

Code anchors:
- Stream layer contracts: `packages/geo/src/cinema/CinematicEngineeringModel.ts` (`DEFAULT_STREAM_LAYERS`)
- 3DEP ops: `docs/3DEP-DATA-OPERATIONS.md`
- Console terrain build script: `tsm-console` → `build:terrain-3d-tiles`
- Native staging: `scripts/native/stage-native-*.mjs`

**Human authority remains final.**
