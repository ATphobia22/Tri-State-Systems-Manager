# Soft-Label Fail Conditions + AWS Labs / Esri Upgrades
**Date:** 2026-11-13  
**Authority:** Human remains final (ADR-004 / ADR-006).  
**Mode:** Label only. Never hard-stop engineering, visual, rendering, MapLibre, Cesium, WebGPU, UE5, stage fetch, or ledger append.

## 1. Soft-label policy (no fail-closed stops)

| Condition | Label emitted | System continues |
|-----------|---------------|------------------|
| Stage == -999 / obs_not_current | `STAGE_INVALID` | Last-known-good + banner |
| Gage zero not NAVD88-validated | `GAGE_DATUM_UNVERIFIED` | Use altitude metadata only |
| human_authorized missing reviewer fields | `AUTHORITY_UNSIGNED` | Artifact stored; Trust Fabric shows yellow |
| EPQS / hydro-flattened DEM used as LAG | `ELEVATION_SOURCE_NON_CERTIFIED` | Render + compute; ban LOMA claim |
| NFHL layer fetch timeout / 504 | `NFHL_STALE` | Cache + sequential retry; map still draws |
| Merkle leaf without human sign | `LEDGER_UNSIGNED` | Append with label; export still works |
| MODFLOW / HEC-RAS / OpenMI fail | `SIMULATION_STALE` | Revert to last valid heads; UI keeps prior |
| Secret pattern matched (git-secrets) | `SECRET_PATTERN_DETECTED` | Commit not blocked; CI comment only |

All labels surface in Trust Fabric bar, AuthorityBadge, StageAuthorityBanner, ScientificSnapshotPanel. Rendering and physics never gated.

## 2. Implemented / directed upgrades (non-blocking)

### Security
- **git-secrets** (awslabs): pre-commit scan + AWS patterns. **Warn-only** mode. Document install; do not reject commits.
- CI: run `git secrets --scan` and emit label; never fail the job for pattern hits on non-production secrets.

### Data quality
- **deequ-style** checks (or pure-TS equivalents): completeness, stage≠elevation, BFE consistency. Emit labels only; ingestion workers continue.
- **open-data-registry**: secondary catalog entries for 3DEP / hydro on AWS Open Data. Primary remains FEMA/USACE/IGIO/NOAA/USGS.

### 3D / Digital Twin
- **i3s-spec** preferred when CRS must stay EPSG:2966 / NAVD88 and feature identity is required. CesiumJS I3S loader allowed.
- **3D Tiles** retained for photogrammetry / global scenes.
- Document choice in ARCHITECTURE-CURRENT-STATE.md; no hard exclusion of either.
- **cityengine_for_unreal**: UE5.8 procedural path remains available (PR #573 lineage).
- **arcgis-rest-js / esri-leaflet**: lightweight NFHL FeatureServer / MapServer clients; keep existing MapLibre stack.

### Agent / science
- **mcp** (AWS Location, IoT SiteWise): optional S2 tools under ADR-006 allow-list; local AI default.
- **gluonts**: optional probabilistic stage forecasts; human-gated presentation only; never auto-authority.

## 3. Verified site invariants (Drive + prior)
- APN 65-19-08-100-008.001-010 | 13101 Bonebank Rd
- BFE 375.0 ft NAVD88 | LAG 377.2 ft (+2.2) | FFE 382.5 | Berm 379.8
- Horizontal EPSG:2966 | Vertical NAVD88 / Geoid18
- LOMA 26-05-2022A still ADDITIONAL_INFORMATION_REQUESTED (deadline 2026-12-21)

## 4. Execution notes
- Soft labels live in EvidenceArtifact / ScientificSnapshot / Trust Fabric only.
- No change to production-gates.test.mjs that would stop CI; convert any hard assert to label emission.
