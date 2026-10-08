# AMBER Gate Assessment — Uploaded 3D/4D Files

**Date:** 2026-10-08
**Source:** Files uploaded to `~/workspace/user/files/` on 2026-10-07 and 2026-10-08
**Reviewer:** Subagent (4D integration task)
**Reference:** AMBER technical review from 2026-10-07 (7 gates)

---

## Gate-by-Gate Assessment

### Gate 1: Camera Registration (🔴 RED)

**Requirement:** TilesRenderer must call `setCamera(camera)` and `setResolutionFromRenderer(camera, renderer)` before `update()`. Without this, SSE-driven LOD switching is not demonstrated.

| File | Verdict | Notes |
|------|---------|-------|
| `TSMOpenWorldTwinView-v2.tsx` | N/A | React Native UI mockup. No TilesRenderer, no Three.js. Placeholder Views only. |
| `TriState3DConsole.tsx` | **FAIL** | UI shell only. Mentions "Camera Sync: MapLibre GL 6.12 + 3D Tiles Renderer" in overlay text but contains zero Three.js/TilesRenderer code. No `setCamera()`, no `setResolutionFromRenderer()`, no `update()` call. |
| All other files | N/A | No 3D renderer code present. |

**Action required:** The actual `OpenWorld3DTilesRenderer` component (referenced in the 2026-10-07 review) was not among the uploads. Camera registration cannot be verified until that component is provided.

---

### Gate 2: MapLibre ↔ Three Geospatial Transform (🔴 RED)

**Requirement:** Defined transform chain: Three.js local frame ↔ ECEF/ENU ↔ WGS84 ↔ MapLibre Mercator.

| File | Verdict | Notes |
|------|---------|-------|
| `TSMCoordinateTransformer.swift` | **PARTIAL** | Provides `indianaWestToWGS84` / `wgs84ToIndianaWest` but uses simplified equirectangular approximation, NOT proper Lambert Conformal Conic inverse. Comments claim "Lambert Conformal Conic Parameters" but math is linear scaling. Not production-grade. Usable as placeholder, not for authoritative positioning. |
| `TriState3DConsole.tsx` | **FAIL** | No transform code. |
| All other files | N/A | |

**Action required:** Implement proper LCC inverse (or use PROJ) for EPSG:2966 ↔ WGS84. Define the full Three.js ↔ ECEF/ENU ↔ WGS84 ↔ MapLibre chain.

---

### Gate 3: NAVD88 → Ellipsoid Conversion (🟢 CLOSED 2026-10-08)

**Requirement:** Implement `h = H + N` with real GEOID18 grid, not approximate constant.

| File | Verdict | Notes |
|------|---------|-------|
| `TriState3DConsole.tsx` | **FAIL + PROHIBITED** | Hardcodes `const gageZeroNavd88 = 352.67` with comment "USGS SIR 2016-5119 verified gage zero". **This is prohibited.** The 352.67 vs 352.71 ft conflict remains OPEN per standing rules. Must not be treated as resolved. |
| `TSMCoordinateTransformer.swift` | **PASS** | `computeNavd88Wse(gageHeightFt:gageZeroNavd88Ft:)` takes gage zero as parameter. No hardcode. Correct pattern. |
| `tsm_temporal_4d_engine.py` | N/A | No datum conversion. |
| Repo `scripts/geospatial/tsm_geodesy.py` | **CLOSED** | Real NGS GEOID18 CONUS grid vendored at `data/geo/geoid18/g2018u0.bin` (Big-Endian, SHA-256 `c41654f1...`). `GeoidModel` now does bilinear interpolation per coordinate; zero constants, fail-closed on missing file or out-of-coverage. Verified at Bonebank anchor (37.845887, -88.005075): N = -30.302 m. |

**Resolved 2026-10-08:** (a) Hardcoded 352.67 remains excluded from repo. (b) Real GEOID18 grid lookup implemented in tsm_geodesy.py via `GeoidGrid` + `GeoidModel.from_grid_file()`.

---

### Gate 4: Implicit-Tile Content Subdivision (🟢 VERIFIED CLOSED)

**Status:** Already verified closed on 2026-10-07/08. Pipeline output in `~/workspace/pipeline-run/implicit-tiles/tileset.json` uses templated content URIs `content/{level}/{x}/{y}.glb` with 479 real GLBs (24.2 MB) and 674 subtree files — genuine spatial subdivision.

None of the uploaded files affect this gate.

---

### Gate  5: Renderer Cache Configuration (🟠 ORANGE)

**Requirement:** Replace `maxMemoryMB` with `maxCacheBytes`, `maxDownloadQueueSize`, `maxParseQueueSize`, `errorTarget`, `maximumDepth`.

| File | Verdict | Notes |
|------|---------|-------|
| All uploaded files | N/A | No TilesRenderer instance in any file. |

**Action required:** Apply when the actual renderer component is integrated.

---

### Gate 6: Provenance Typing (🟠 PARTIAL)

**Requirement:** OBSERVED / DERIVED / SIMULATED / SCENARIO labels on building heights and flood values.

| File | Verdict | Notes |
|------|---------|-------|
| `TriState3DConsole.tsx` | **PARTIAL** | ✅ Button-only `handleFetchLiveSnapshot` correctly implements snapshot policy. ✅ Flood overlay labeled "Diffusion Flood Overlay (Screening)". ❌ `Building3DTileMetadata` interface has no provenance field. ❌ No OBSERVED/DERIVED/SIMULATED/SCENARIO typing. |
| `TSMOpenWorldTwinView-v2.tsx` | **FAIL** | Hardcoded `stageFt: 18.42`, `navd88WseFt: 389.52` with `status: 'LIVE OBSERVATION'`. **Prohibited:** hardcoded values labeled as live. FEMA overlay says "BFE 391.0 ft NAVD88" but working BFE is 375.0 ft — discrepancy. |
| `TSMMapDataFabricService.swift` | **FAIL** | `getOfflineFallbackStations()` returns hardcoded stations with `status: .live`. Fallback must be STALE/UNAVAILABLE, not LIVE. Also mislabels 03378500 as "Mount Carmel" (correct: New Harmony; Mount Carmel is 03377500). |
| `TSMAppleMapsDigitalTwinView.swift` | **FAIL** | Hardcoded gauge annotations (18.42 ft, 389.52 ft) labeled "LIVE OBSERVATION". Same 03378500 naming error. |
| `TSMHydraulicCutawayModal.tsx` | **PASS** | Uses `simulatedWseFt` state variable — explicitly labeled as simulation. Berm/road placement is the allowed simulation exception. Controls are user-adjustable, not presented as historical. |
| `tristate_4d_model.ts` (GOCAD) | **FAIL** | Flood surfaces 372.5/376.8/378.2 ft not labeled as SCENARIO. See integration notes below. |
| `export_gocad_4d.py` | **FAIL** | Generates 372.5/376.8/378.2 as "Flood Crests" with comments "Exceeds BFE", "Severe Flood Event". **Prohibited** as historical truth. Must be SCENARIO. |

**Action required:** See integration section for labeling applied.

---

### Gate 7: React Implementation Composition (🔴 RED)

**Requirement:** TriState3DConsole should be a composition root with submodules, not a monolithic component.

| File | Verdict | Notes |
|------|---------|-------|
| `TriState3DConsole.tsx` | **INCOMPLETE** | 257 lines (not 1000+). Single component. It's a UI shell — sidebar controls + empty map viewport div. No actual 3D implementation to decompose. Cannot assess composition until the renderer, geodesy, tiles, buildings, temporal, and validation submodules exist. |
| `TSMOpenWorldTwinView-v2.tsx` | N/A | React Native iOS prototype (720 lines, mostly styles). Not the web console. |

**Action required:** When the real 3D implementation is built, structure as composition root per the 2026-10-07 review recommendation.

---

## Prohibited Patterns Found

| Pattern | File(s) | Disposition |
|---------|---------|-------------|
| `Procedural4DCityGrowth` (growth_factor, storeys from year%3, synthetic IDs) | `tsm_temporal_4d_engine.py` | **Labeled SIMULATED** in integrated copy. Never historical truth. |
| Synthetic flood surfaces 372.5 / 376.8 / 378.2 ft as "flood crests" | `tristate_4d_model.ts`, `export_gocad_4d.py` | **Labeled SCENARIO** in integrated copies + docs. |
| Synthetic berm-elevation drift (368.5 → 371.2 ft) | `tsm_temporal_4d_engine.py` main(), `export_gocad_4d.py` | **Labeled SIMULATED** in integrated copies. |
| Hardcoded gage zero 352.67 ft as "verified" | `TriState3DConsole.tsx` | **NOT integrated.** Conflict with 352.71 remains open. |
| Hardcoded gauge values labeled "LIVE OBSERVATION" | `TSMOpenWorldTwinView-v2.tsx`, `TSMMapDataFabricService.swift`, `TSMAppleMapsDigitalTwinView.swift` | **NOT integrated.** Violates button-only snapshot policy. |
| Station 03378500 mislabeled "Mount Carmel" | `TSMMapDataFabricService.swift`, `TSMAppleMapsDigitalTwinView.swift` | **NOT integrated.** Correct: New Harmony (03378500); Mount Carmel is 03377500. |

---

## What Was Integrated

| Source | Destination | Modifications |
|--------|-------------|---------------|
| `tsm_temporal_4d_engine.py` | `scripts/geospatial/tsm_temporal_4d_engine.py` | Prepended provenance warning banner. `PointTube` and `DeltaStorage4D` are legitimate (match requirement #7). `Procedural4DCityGrowth` retained but explicitly labeled *** SIMULATED ***. |
| `export_gocad_4d.py` | `scripts/geospatial/export_gocad_4d.py` | Prepended provenance warning banner. `GocadTSurfExporter` class is a legitimate format converter. `generate_full_4d_gocad_model()` synthetic data generation labeled *** SCENARIO ***. |
| `tristate_4d_model.ts` (GOCAD) | `docs/examples/4d-scenario/tristate_4d_model.gocad` | Renamed to `.gocad` (it is GOCAD TSurf, not TypeScript). Placed in examples with README. |
| `tristate_posey_buildings_4d.gocad` | `docs/examples/4d-scenario/tristate_posey_buildings_4d.gocad` | Placed in examples with README. |
| New | `docs/examples/4d-scenario/README.md` | Documents synthetic nature, prohibited uses, legitimate uses. |

Both Python files pass `py_compile`.

## What Was Excluded (Not Integrated)

1. **`TriState3DConsole.tsx`** — Contains prohibited hardcoded gage zero 352.67 ft as "verified". The button-only snapshot pattern is correct and can be referenced, but the file as-is cannot be integrated until the gage zero is parameterized.

2. **`TSMOpenWorldTwinView-v2.tsx`** — React Native iOS prototype with hardcoded "LIVE OBSERVATION" values. UI mockup only, no real 3D.

3. **`TSMGaugeService.ts`** — Clean service client (no prohibited patterns), but references `https://tsm.tristate.org/api` which does not exist. Not integrated; no active API to connect to.

4. **`TSMCoordinateTransformer.swift`** — Simplified (inaccurate) projection math. Not integrated; the Python `tsm_geodesy.py` is the authoritative geodesy module.

5. **`TSMMapDataFabricService.swift`** — Hardcoded fallback labeled `.live` + station naming error. Not integrated.

6. **`TSMAppleMapsDigitalTwinView.swift`** — Hardcoded "LIVE OBSERVATION" annotations + station naming error. Not integrated.

7. **`TSMHydraulicCutawayModal.tsx`** — Correctly labeled simulation (allowed exception). Not integrated (React Native iOS, repo console is web); pattern documented here for reference.

8. **`app.json`, `Fastfile.txt`** — iOS build config, not applicable to current repo state.

---

## Recommendations

1. **Do not integrate the iOS Swift files** until the hardcoded live values are fixed and the API endpoint exists.
2. **TriState3DConsole.tsx** can serve as a UI reference for the button-only snapshot pattern, but the gage zero must be parameterized before any integration.
3. **The GOCAD exporter** (`scripts/geospatial/export_gocad_4d.py`) is now available as a format utility for legitimate 4D exports from real data.
4. **PointTube** (`scripts/geospatial/tsm_temporal_4d_engine.py`) complements the existing `scripts/geospatial/point_tube.py` (requirement #7).
5. **Gate 3 (GEOID18)** remains the highest-priority open gate: vendor the NGS GEOID18 CONUS binary subset and implement bilinear interpolation in `tsm_geodesy.py`.
