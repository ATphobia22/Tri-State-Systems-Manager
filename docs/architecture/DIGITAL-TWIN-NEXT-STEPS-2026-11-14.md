# Digital Twin — Next Steps & Gap Closure (2026-11-14)

**Status:** operational roadmap. Does not claim Shipping UE5.8, full 23,082 verified building heights, or regulatory determination.

## Current twin surfaces (implemented)

| Route | Role |
|-------|------|
| `/map` | Hydraulic Map — MapLibre + stage/jurisdiction |
| `/twin` | Twin Canvas — full-bleed cinematic host |
| `/digital-twin` | Twin Summary — card elevations; user-triggered gauges |
| `/digital-twin-v2` | Digital Twin 3D — immersive, lazy-loaded |

Planes: Experience · Operations/API · Authoritative data fabric · Model boundary · Evidence · Human review.

## Priority gap stack (complete in order)

### P0 — Unblock main (draft PRs)
1. **#581** Posey DEM staging recovery + honest ground-elevation provenance  
2. **#580** COPC multipart / interior-hole roof sampling  
3. **#577** UE5.8 two-way physics, governed HLOD/SSE, Cesium pin  

*Action:* Mark ready → CI green → squash to main.

### P1 — Terrain & building truth
- Finish DEM tile recovery planner against IGIO + 3DEP; null unsampled heights (no invented elevation).
- Re-run COPC roof sampling after #580; record OBSERVED / DERIVED / UNAVAILABLE counts; do not claim 23,082 complete until measured.
- Align 3D Tiles implicit quadtree + glTF Y-up / tile Z-up (already partially on main via #586).

### P2 — Live fabric
- USGS-first stage (03378500, 03322000, …) via OGC + NWPS; reject sentinel −999 / obs_not_current.
- NLD overlay read-only (NAD83/NAVD88); no accreditation claims.
- TimesFM / GEOGloWS behind `packages/forecasting` — label SIMULATION_DEMO; never replace NWPS/e-FARA.

### P3 — Visualization / cinematic
- ACEScg path per `docs/cinema/ACES-OCIO-COLOR-PIPELINE.md` + `ACESCG-GAMUT-MAPPING-v1.md`.
- Lumen gates per `docs/native/UE58-LUMEN-INTEGRATION-GATES-v1.md` — cinematic only.
- MRQ / Sequencer receipts; science channels never through ODT.

### P4 — Evidence & LOMA
- Case 26-05-2022A: human-gated package only; no auto LOMA.
- validateEvidenceArtifact: human_authorized requires reviewer_identity / reason / reviewed_at.
- FIRM → BAFL → certified survey hierarchy enforced in policy engine.

### P5 — Engineering packages (wired)
`@tsm/survey` · `cogo` · `least-squares` · `landxml` · `openmi` · `forecasting` · `release-gates` · `approval-workflows` — extend adapters; no silent evidence promotion.

## Explicit non-goals this cycle
- Universal hydraulic solver or automatic permitting.
- Hardcoded anchor parcel/elevations as design constants.
- Treating Lumen GI or cinematic flood as LOMA evidence.

## Acceptance for “twin complete enough”
1. Draft PRs 577/580/581 on main.  
2. Height inventory: counts + sources published; unsampled = null.  
3. Live gage path fail-closed in CI.  
4. Human authority gates green in production-gates tests.  
5. Cinematic path labeled; science path raw.
