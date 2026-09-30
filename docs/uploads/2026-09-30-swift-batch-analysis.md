# Upload batch analysis — 2026-09-30 (Swift + TSX + mapping data)

Source: 10 files uploaded by Anthony on 2026-09-30 ~09:23 CDT.
Origin assessment: another AI's iOS/React-Native companion code for the TSM twin.

## Verdicts

### PORT (structure/logic only, data stripped)

1. **TSMCoordinateTransformer.swift** → `tsm-console/src/lib/geodetic/tsm-coordinate-transformer.ts`
   - API shape ports cleanly. BUT the projection math is wrong: it implements an
     equirectangular approximation while the header claims Lambert Conformal Conic,
     and the std parallels listed are Indiana EAST's, not West's. Indiana West
     (EPSG:2966) is Transverse Mercator per the repo's authoritative
     `PROJ4_EPSG_2966`. False easting also wrong (2,952,750 ft vs 2,952,755.906 ft).
   - Port = reimplement with correct TM series, validated against pyproj vectors.

2. **TSMMapDataFabricService.swift** → types only.
   - Station model + status enum (LIVE/STALE/CANDIDATE/UNAVAILABLE) port as TS types.
   - The `fetchCommunityGauges()` live-polling client is REJECTED (retired telemetry;
     unverified `tsm.tristate.org` domain). The `getOfflineFallbackStations()`
     readings are REJECTED (fabricated stage/WSE values with fake provenance
     signatures).

3. **TSMAppleMapsDigitalTwinView.swift** → HUD patterns only (MapKit → MapLibre).
   - Portable: top HUD bar, chip toggles, gauge annotation card layout, map style
     picker, layer toggles.
   - REJECTED: hardcoded "LIVE OBSERVATION" readings (fabricated), hand-drawn
     4-point polygon labeled "FEMA 100-Year Floodplane" (not NFHL data),
     "proposed cutoff road" 3-point sketch presented as engineered.

4. **TSMOpenWorldTwinView-v2.tsx** (React Native) → cinematic HUD web components.
   - Portable: collapsible cinematic drawer, ENGINEERING/DATA FABRIC/TWIN ENV tabs,
     berm/road mode buttons, HUD collapse toggle.
   - REJECTED: "ray-tracing PBR" toggle (theater), fabricated gauge state
     (18.42 ft / 389.52 ft "LIVE"), fake "BFE 391.0 ft" label, invented fill
     estimate (14,850 cu yds).

5. **TSMHydraulicCutawayModal.tsx** (React Native) → web modal with honest labels.
   - Portable: cutaway diagram layout, WSE/berm steppers, remediation toggles.
   - REJECTED as engineering: `baseFs = 1.65 - headDiff*0.035 + ...` "simplified
     Bishop" factor-of-safety and the piping-risk rule are invented math. Ported
     version labels all computed stability values ILLUSTRATIVE — NOT engineering
     analysis, matching the repo's evidence-boundary pattern.

### DATA

6. **24K_USGS_Quadrangle_Boundaries.kml/.gdb.zip** — genuine USGS 24K quad
   boundaries, 36 quads covering Posey County tri-state area (Mount Carmel,
   Mount Vernon, New Harmony, Evansville…). Converted to GeoJSON reference fabric.
7. **NFHL_18_20260706_metadata.xml** — byte-identical to already-vendored
   `data/regulatory/nfhl-indiana-20260706-metadata.xml`; not re-vendored.
8. **Engage_UserGuide.pdf** — XSoft Engage parcel viewer guide; reference only.
9. **Bedrock_Aquafina.pdf** — 2-page printout; reference only, not integrated.

## Standing rules applied
- No live river telemetry. No demo content. No fabricated observations, elevations,
  coordinates, thresholds, or model outputs. Free/open-source only.
