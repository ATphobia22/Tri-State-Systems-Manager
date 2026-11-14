# Digital Twin — Next Steps & Gap Closure (2026-11-14)

**Updated:** resilient gauges (retries / LKG snapshots / auto-correct) — **not** fail-closed.

## Current twin surfaces

| Route | Role |
|-------|------|
| `/map` | Hydraulic Map |
| `/twin` | Twin Canvas |
| `/digital-twin` | Twin Summary |
| `/digital-twin-v2` | Digital Twin 3D |

## Priority stack

### P0 — Unblock main (draft PRs — user must mark ready)
1. **#581** DEM staging recovery  
2. **#580** COPC multipart roof sampling  
3. **#577** UE5.8 physics / HLOD / Cesium pin  

### P1 — Terrain & building truth
- DEM recovery planner; null unsampled heights  
- Re-run COPC after #580; publish OBSERVED/DERIVED/UNAVAILABLE counts  

### P2 — Live fabric (resilient, not fail-closed)
- **Implemented:** `@tsm/hydrology` `fetchStageResilient` — multi-fetcher retries, exponential backoff, sentinel auto-correct, LKG snapshot fallback, soft estimated if no LKG  
- Wire USGS OGC → NWPS → community → LKG  
- NLD overlay read-only  
- TimesFM screening only (SIMULATION_DEMO)  

### P3 — Cinematic
- ACEScg + Lumen gates (docs already on main)  

### P4 — Evidence / LOMA
- Case 26-05-2022A human-gated  
- FIRM → BAFL → survey  

### P5 — Engineering packages
- survey / cogo / least-squares / landxml / openmi / forecasting / release-gates / approval-workflows  

## Gauge policy (product direction 2026-11-14)
- Prefer **recovery** over fail-closed.  
- Auto-retry failed sources; auto-correct −999/nonfinite; serve last-known-good snapshot when live fails.  
- Always label quality: `ok` | `corrected` | `stale` | `estimated`.  
- Still **not** regulatory BFE or NFIP determination.
