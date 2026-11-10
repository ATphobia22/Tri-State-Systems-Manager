# Open-World Digital Twin — Tri-State River Valley

**Metaphor:** 3D open world × SimCity-style systems view × real engineering/infrastructure evidence.  
**Policy:** Informs people; human authority remains final. Not FIRM, not LOMA, not emergency dispatch.

## 1. `wire-experience-routes.mjs` — what it does

Path: `scripts/native/wire-experience-routes.mjs`

**Purpose:** Idempotent local/CI helper so React Router exposes the signature experience URLs.

**Behavior:**
1. Resolves repo root and opens `tsm-console/src/lib/router.tsx`.
2. If the string `cinematic-engineering` is already present → prints `already wired` and exits 0.
3. Otherwise finds the existing **cinematic** route line (the “needle”).
4. Inserts five sibling routes immediately after it:
   - `/cinematic-engineering`
   - `/workspaces`
   - `/experience/living-river`
   - `/experience/scenario-sandbox`
   - `/experience/evidence-storyboard`
5. Writes `router.tsx` back to disk.

**When to run:** After `git pull` if those paths 404 in `npm run dev`. Safe to re-run.

```bash
node scripts/native/wire-experience-routes.mjs
cd tsm-console && npm run dev
```

---

## 2. 3D terrain streaming pipeline (detailed)

### Stage A — Authoritative acquisition
- Query USGS National Map / 3DEP for the AOI (Posey / confluence).
- Record product ID, CRS, vertical reference, resolution, quality level, download URL.
- Hash binaries (SHA-256). **Do not commit LAS/LAZ to Git.**
- Reference: `docs/3DEP-DATA-OPERATIONS.md`.

### Stage B — Derivation
- Resample to display grids (e.g. Terrain-RGB / Terrarium PNG, heightmap, optional quantized-mesh / 3D Tiles terrain).
- **Never silent vertical transform** — log method, software, uncertainty.
- Tag outputs **DERIVED** / screening unless PE survey supersedes.

### Stage C — Distribution
| Channel | Use |
|---------|-----|
| GitHub Pages XYZ | Public web terrain_3dep tiles |
| Martin / PMTiles / PostGIS | Scale-up vector+terrain |
| Private Drive → staged TSMData | Native UE offline |

### Stage D — Runtime decode
- **Web:** MapLibre `terrain` source + exaggeration; optional Cesium terrain/tileset.
- **Native:** UE World Partition + landscape from staged tilesets.
- Client reconstructs elevation from tile encoding (e.g. Terrarium RGB → meters).

### Stage E — Composition (SimCity-class layers)
Stack with authority badges:
1. Terrain (DERIVED)
2. Imagery / base map (PRESENTATION)
3. Parcels / roads (REGULATORY or jurisdictional)
4. NFHL / FIRM context (REGULATORY)
5. Live stage NWPS/USGS (OBSERVATION, GAGE_DATUM)
6. Scenario WSE / freeboard (MODEL_SIMULATION)
7. Cinema camera / weather (PRESENTATION)

### Stage F — Interaction
- Explore (fly, search places)
- Inspect (parcel, elevation sample, source verify)
- Scenario (LAG−BFE, compare alternatives)
- Evidence storyboard (hashes unchanged by cinema)

### Gage math (do not confuse)
- Stage is **above local gage zero**, not NAVD88 by itself.
- MTVI3 product zero: **318.59 ft NAVD88** (NWPS).
- `WSE = stage + gage_zero` only for **matching stationId**.

---

## 3. System architecture (open world)

```text
┌──────────────────────────────────────────────────────────────────────┐
│                     EXPERIENCE PLANE (people)                         │
│  Living River · Scenario Sandbox · Evidence→Cinema · Workspaces      │
│  /cinematic-engineering  /twin  /map  /flood-sim  /workspaces          │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│                     RUNTIME CLIENTS                                   │
│  MapLibre+R3F (web) │ Cesium (opt) │ UE5.8 World Partition (native) │
└───────┬─────────────────────┬─────────────────────┬──────────────────┘
        │                     │                     │
   Terrain-RGB/MVT      3D Tiles/GLB          Staged TSMData
        │                     │                     │
┌───────▼─────────────────────▼─────────────────────▼──────────────────┐
│                     DISTRIBUTION                                      │
│  Pages · Martin · object storage · Drive restore + checksums          │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│              EVIDENCE + SCIENCE PLANE                                 │
│  NFHL · NWPS/USGS · 3DEP · NCAT/VDatum · HEC/SWMM bridges (import)    │
│  Merkle/ledger · capability control plane · human gates               │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────┐
│              GOVERNANCE                                               │
│  ADR human authority · no auto-LOMA · gage-zero unpublished default   │
└──────────────────────────────────────────────────────────────────────┘
```

## 4. Infrastructure “SimCity” systems map

| System | Real sources | TSM surface |
|--------|--------------|-------------|
| Terrain | 3DEP | Streaming tiles DERIVED |
| Flood hazard | FEMA NFHL/MSC | Regulatory overlay |
| Rivers | USGS, NWPS MTVI3 | Stage OBSERVATION |
| Parcels | IGIO / assessor | Selection + inspector |
| Structures | 3D Tiles/GLB | DERIVED massing |
| Scenarios | PE inputs + models | Sandbox MODEL |
| Cinema | Sequencer/web path | PRESENTATION |

## 5. Local + CI

```bash
npm ci && cd tsm-console && npm ci
node scripts/native/wire-experience-routes.mjs
cd tsm-console && npm run dev
node scripts/native/windows-cinematic-release-test.mjs
```

Native Shipping: `docs/release/UE58-ONE-SHOT-SHIPPING-RUNBOOK-2026-11-10.md`

**Human authority remains final.**
