# TSM Maps & Flood Simulator — Peer Review Package

**Prepared:** 2026-10-06 · **Repo:** `ATphobia22/Tri-State-Systems-Manager` · **Branch:** `main`
**Purpose:** give an independent reviewer everything needed to evaluate what the
flood simulator and map layers do, what data they use, and where the limits are.
No marketing. If something below is wrong, that is itself a finding.

---

## 1. What the flood simulator does

Three modules, chained by a fourth. All in `tsm-console/src/lib/`.

| Stage | File | Method | Provenance label |
|---|---|---|---|
| Rainfall → runoff | `hydrology-runoff.ts` | SCS Curve Number (TR-55): S = 1000/CN − 10, Ia = 0.2S; cumulative Q differenced per timestep into a Q(t) hydrograph | `scs-cn-v1` |
| Runoff → inundation | `hydraulics-diffusion2d.ts` | Explicit finite-difference **diffusion-wave (zero-inertia)** on a raster grid; Manning-based face fluxes; closed boundaries; enforced diffusive-CFL stability check (throws fail-closed on violation) | `diffusion-wave-2d-v1` |
| Orchestration + alerts | `scenario-runner.ts` | Chains SCS → diffusion-wave; evaluates threshold alert rules → `triggered: true/false/'unknown'` (missing data yields `'unknown'`, never silent `false`) | `scenario-runner-v1` |
| Damage screening | `hazus-depth-damage.ts` | Occupancy depth-damage curves (RES-1SNB from published USACE generic curve; others adapted to published Hazus/USACE shapes); linear interpolation; 10-ft clamp, no extrapolation | labeled **Hazus-compatible methodology — not FEMA-certified** |

## 2. What the simulator does NOT do

- **Not full Saint-Venant.** The 2D model is zero-inertia diffusion-wave: no
  shocks, no supercritical flow, no infiltration. Volumes are conservative.
  Full 2D Saint-Venant was explicitly **deferred** by documented decision
  (`docs/ROADMAP-BUILD-2026-09-25.md`, "Decision: 2D hydraulic strategy").
  Any text implying Saint-Venant/SRH-2D capability is wrong — flag it.
- **Not calibrated.** SCS has no channel routing, no baseflow, no calibration
  against gauge events. Hazus curves need local calibration. Results are
  **screening-level estimates**, not flood predictions.
- **Not a regulatory determination.** Every output is labeled `MODELED` +
  `DERIVED`. A `PASS` from the screening engine is not a permit, legal opinion,
  or PE certification. No licensed PE has signed anything in this repo.
- **Coupling is approximate.** Lumped total runoff is spread uniformly in space
  and time over the grid (documented in `scenario-runner.ts` header).

## 3. Input data provenance (map layers)

Source of truth: `tsm-console/src/lib/map-layers.ts` (each entry carries
`authority_class`, attribution, and notes). Authority classes: REGULATORY /
OBSERVATION / PLANNING / DERIVED / CONTEXT / VISUALIZATION.

| Layer | Source | Vintage | Authority | Notes |
|---|---|---|---|---|
| FEMA NFHL | `hazards.fema.gov/.../NFHL/MapServer` (live) | Effective (current) | REGULATORY (federal) | Layers discovered dynamically by semantic name; hardcoded layer-28 removed 2026-10-06. The flood-insurance authority plane. |
| Indiana BAFM | `gisdata.in.gov/.../Best_Available_Flood_Hazard_Layer/MapServer` (live) | Current state product | PLANNING (state) | **Never merged with NFHL.** State planning product, not insurance evidence. |
| USACE NLD leveed areas | Local `tsm-console/public/data/leveed-areas-wabash-v1.geojson` | Retrieved 2026-10-06 | REGULATORY (federal) | Wabash Levee Units 1 & 2 (270005000005/6). SHA-256 `695bb9bd…41a519` byte-identical to live NLD2 API payload. NAD83/NAVD88. Re-fetch: `tools/acquisition/usace/fetch-leveed-areas.mjs`. |
| Indiana parcels | IGIO `Parcel_Boundaries_of_Indiana_2025` (live) | Released 2025-12-01 | CONTEXT | Not a survey product; county accuracy varies. No owner-name fields. |
| Indiana imagery | IGIO `Indiana_Current_Imagery` ImageServer (live) | 2022–2025 | OBSERVATION | Base imagery; `exportImage` operation (corrected 2026-10-06). |
| USGS 3DEP terrain | Self-hosted Terrain-RGB tiles, zooms 8–12 | 3DEP QL2 / best-available | OBSERVATION | No fabricated terrain fallback; fail-closed if template unset. |
| Building footprints | IGIO `Building_Footprints` 2016–2020 (live) | **2016–2020 — STALE** | DERIVED | LiDAR-derived reference only. Do not treat as current survey geometry. |
| Posey CSLF | `Posey_CSLF_Feb2025` (live) | Feb 2025 | CONTEXT | Preliminary/pending map-change evidence; not effective NFHL. |
| USGS gauges | `api.waterdata.usgs.gov` (live); `waterservices.usgs.gov` retired 2026-02-22 | Live | OBSERVATION | **Button-only**: fetched solely on explicit user "Fetch live snapshot"; page loaders return unavailable sentinel; no polling (dead `startGaugePoll` removed 2026-10-06). |
| CWMS stage | `cwms-data.usace.army.mil` (live) | Live | OBSERVATION | Optional plane via `usace-cwms.mjs`; caller-initiated only; not a USGS replacement. |

### Stale / watch-list sources

1. **Indiana building footprints 2016–2020** — 6–10 years old; already flagged
   in-layer. Any analysis depending on current structures must not use it.
2. **FEMA NFHL MapServer** — intermittently unreachable from some networks
   (egress proxy drops); verified working via GitHub Actions FEMA-recovery run
   2026-10-06. Treat fetch failures as unavailable, never as zero.
3. **BAFM vs NFHL** — distinct authority planes by design; any code or doc
   merging them is a defect.

## 4. How to reproduce

```bash
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager
cd Tri-State-Systems-Manager

# Flood simulator unit tests (hand-computed vectors, mass conservation, symmetry)
cd tsm-console && npx vitest run src/lib/hydrology-runoff.test.ts \
  src/lib/hydraulics-diffusion2d.test.ts src/lib/scenario-runner.test.ts \
  src/lib/hazus-depth-damage.test.ts

# Full console suite + type check + production build
npx vitest run && npx tsc --noEmit && npm run build

# Backend tests
cd ../backend && python -m pytest

# Re-fetch levee polygons (requires network; writes SHA-256 receipt)
node ../tools/acquisition/usace/fetch-leveed-areas.mjs
```

Expected (2026-10-06): TypeScript clean; 399/399 vitest pass; backend green.

## 5. What a reviewer should check

1. **Math honesty:** do the module headers match the implemented numerics?
   (`hydraulics-diffusion2d.ts` header vs. the update loop; CFL check present?)
2. **Label discipline:** is every simulator output tagged `MODELED`/`DERIVED`
   via `provenance-labels.ts`, and is anything presented as `OBSERVED` or
   `FEMA-EFFECTIVE` that isn't?
3. **Authority separation:** does any map, doc, or UI text merge BAFM into NFHL,
   present NSI structures as survey truth, or present estimated well locations
   as survey-grade?
4. **Fail-closed behavior:** feed invalid inputs (negative rain, zero dt,
   missing gauge) — do you get throws/`'unknown'`/unavailable, never silent
   zeros or interpolated guesses?
5. **Telemetry policy:** is there any fetch on page load, navigation, timer, or
   background refresh? (Standing rule: live values only via explicit button.)
6. **Stale data:** is the 2016–2020 building-footprint layer used anywhere it
   shouldn't be? Are "verified <date>" claims still true?
7. **3D status honesty:** `ThreeDTilesLayer` reports `ready` only on the
   tileset `load-tileset` event — confirm no path reports ready on construction.

## 6. Known limitations (not defects)

- Diffusion-wave is screening-level by design; the Saint-Venant build-vs-revise
  decision is closed as "revise claims to match implementation."
- SCS/Hazus uncalibrated — needs observed event pairs and local building data.
- iOS `.ipa` unbuilt (needs Mac); Oracle A1 instance does not exist (blocked on
  login — a green "Oracle Deploy" workflow soft-skips without secrets and
  proves nothing).
- Deployed building `tileset.json` absent (404); building tiles are local-only.
- LOMA 26-05-2022A pending (FEMA Additional Information requested); LAG 377.2
  owner-supplied, uncertified; BFE 375.0 working value, not certified evidence.
