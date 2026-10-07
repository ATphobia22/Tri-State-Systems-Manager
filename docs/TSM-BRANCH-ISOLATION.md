# TSM Branch Isolation: Authoritative / Derived / Simulated

**Date:** 2026-10-07
**Status:** Enforced by validators; this document is the normative reference.

## The three branches

```
AUTHORITATIVE                    DERIVED                          SIMULATED
─────────────                    ───────                          ─────────
IGIO OBJECTID                    LOD1 mesh                        procedural growth
footprint geometry               LOD2 mesh                        synthetic structures
ground NAVD88 (3DEP)             HLOD quadtree                    scenario flood states
LiDAR roof observations          GLB tiles                        scenario trajectories
  (Classification 6)             3D Tiles subtrees                FORECAST PointTube samples
derived building height          feature metadata
  (median roof-ground)           Draco-compressed GLBs
roof planes (RANSAC)             SHA-256 manifests
LOD classification
provenance + uncertainty
```

## Hard acceptance criterion

```
23,082 source features
  == 23,082 validated
  == 23,082 height-linked
  == 23,082 derived identities
  == 23,082 metadata identities
  == 23,082 mesh identities
  == 23,082 HLOD mappings
```

Plus all validators PASS. Any break in this chain fails the build.

## Isolation rules

1. **Zero simulation data enters the authoritative set.** The 23,082 IGIO
   OBJECTIDs are the closed authoritative universe. No synthetic building,
   no procedural street, no scenario flood surface may carry an IGIO OBJECTID
   or appear in authoritative outputs.

2. **Derived data cites authoritative sources.** Every derived artifact
   (GLB, tile, subtree) records its source OBJECTIDs and transformation
   provenance in its manifest. Derived data that cannot name its
   authoritative sources is rejected.

3. **Simulated data is labeled at creation.** Any `SIMULATED` or `FORECAST`
   PointTube sample, scenario flood plane, or procedural geometry must carry
   `authorityClass: SIMULATED` from the moment of creation. Relabeling
   simulated data as authoritative is prohibited.

4. **Validators enforce the boundary:**
   - `validate_feature_linkage.py --geojson`: exact OBJECTID set equality
     between source and tileset (catches injected synthetic IDs).
   - Authority-boundary check (below): scans outputs for SIMULATED-labeled
     content in authoritative paths.

## Authority-boundary validator

`scripts/geospatial/validate_authority_boundary.py` (to be wired into CI):

- Walks the authoritative output directories.
- Fails if any file contains `authorityClass: SIMULATED` or
  `state: SIMULATED` markers.
- Fails if any OBJECTID appears that is not in the source 23,082 set.
- Fails if any `lidarHeightFt` value lacks `lidarHeightMethod` provenance
  (blocks assumed heights re-entering through the side door).

## What is NOT permitted

- `height = storeys * 3.5` (unvalidated assumption)
- Fixed 10-ft extrusion as production default
- `"roof_type": "gable"` inferred from storey count
- `"is_watertight": true` without validation
- Flood surfaces at invented WSE values presented as events
- Procedural city growth (Wonka et al.) in any authoritative output
- Silent NAVD88-to-ellipsoid conversion (must use `tsm_geodesy.py` chain)
- Silent vertical datum assumptions (must carry explicit labels)

## Current status (2026-10-07)

Repo is **NOT GREEN**. Known gaps against the acceptance criterion:
- 4,121 GLBs exist vs 23,082 required (full LiDAR extraction not yet run).
- LOD2 mesh generation from roof planes not yet wired into the builder.
- Authority-boundary validator script not yet written (this doc is normative first).
