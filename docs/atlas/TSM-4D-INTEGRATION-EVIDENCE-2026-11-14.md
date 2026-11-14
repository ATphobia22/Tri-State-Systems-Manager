# TSM four-dimensional source integration: evidence and release runbook

**Status as of 2026-11-14:** source and contract implementation; **not** a survey-certified regional mesh or a calibrated operational flood forecast.

## 1. Public cinematic Atlas

- The Pages Atlas uses the existing MapLibre three-state map with region selection, real USGS station-location geometry, USACE eHydro survey extent polygons, and optional NPS historic-site context.
- **Play/Stop Wabash flyover** now calls the existing source-controlled camera keyframes on the *loaded* MapLibre map. Browser reduced-motion preference turns this into a nonanimated static view.
- **3D building meshes** is an explicit opt-in toggle. It lazily loads the already committed `tsm-console/public/3d-tiles/buildings-lidar-12450/tileset.json` through the existing 3D Tiles renderer; those meshes are only a partial LoD1 visualization product. No claim is made about 23,082 independently height-verified features, LoD2–LoD4 roofs, or survey-accurate alignment.
- OpenFreeMap's existing named water/river polygon fill layers receive a cinematic color treatment. **Water styling is not river bathymetry, hydraulic water-surface elevation, a flood outline or current stage.**
- Time-of-day slider controls **presentation light**, not model time or a hydrologic simulation. Proposal drafts remain explicitly unverified planning shapes.

Production terrain RGB mesh remains disabled when `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` is not a real hosted, functioning XYZ source. The previously tracked `terrain_3dep/tiles.json` is a manifest, not proof that PNG tile pyramids or their height datum are available. Before enabling high-resolution terrain: obtain the official USGS 3DEP source GeoTIFF, hash source bytes, inspect raster headers for CRS, units, NAVD88/geoid and nodata, verify tile encoding against control points, stage actual PNG tiles with successful HTTP/CORS checks, then inspect the 3D scene in a headed browser/Windows build. A Web Mercator hillshade or street layer does not replace a DEM. See [USGS 3DEP DEM datum guidance](https://www.usgs.gov/faqs/what-projection-horizontal-datum-vertical-datum-and-resolution-a-usgs-digital-elevation-model) and [The National Map](https://www.usgs.gov/the-national-map-data-delivery/gis-data-download).

## 2. Archived Posey mesh evidence: independently byte-audited

Recovered Drive object: `posey-fixed-part01.tar.zst` (24,767,064 bytes), SHA-256 `218cc1dd334f9b2eebd33429cb14a48cebcda1ef980c16384d2dfd4f104e57f8`.

Independent extraction and hash checks, 2026-11-14:
- Archive: 42,837 entries, 20,517 primary `flat/*.glb` payloads, 20,517 `flat-local/*.glb` payloads; separate implicit LoD1 tiling with 718 GLBs and 539 subtrees.
- All 20,519 `flat/SHA256SUMS` references verified (20,517 source-ID GLBs + manifest + tileset), including valid glTF 2 GLB headers.
- Exactly 20,517 unique archive `sourceObjectId` labels, matching tile URI, manifest and both flat GLB name sets.
- Source-declared height provenance: 11,826 `OBSERVED`, 8,691 `DERIVED`, 0 estimated fallback. Every source tile metadata entry has finite `lidarHeightFt` and `groundElevationFtNavd88`; reported ranges 1.84–147.33 ft and 335.7244–586.1012 ft, respectively.
- The source manifest calls its footprint inventory *Indiana Building Footprints 2016–2020* with 20,517 features. This is **not a proof of reconciliation** to the separate 23,082-feature baseline or the checked-in 22,815 screening footprint snapshot. Those are different documented inventory states; subtracting counts does not establish which objects are missing.
- The source provides a GeoJSON digest but not its verified source bytes or independent survey control. Internal checksum integrity is **not** source correctness or vertical transformation evidence.

Reproduce the audit after first checking that the archive has no path traversal, symlinks or absolute members and safely extracting to a disposable folder:

```sh
sha256sum posey-fixed-part01.tar.zst
zstd -t posey-fixed-part01.tar.zst
# Inspect tar members BEFORE extraction; do not extract untrusted archives blindly.
tar --use-compress-program=zstd -tf posey-fixed-part01.tar.zst
python scripts/geospatial/audit_posey_3d_archive.py \
  --extracted-root /path/to/validated/extraction \
  --archive /path/to/posey-fixed-part01.tar.zst \
  --expected-archive-sha256 218cc1dd334f9b2eebd33429cb14a48cebcda1ef980c16384d2dfd4f104e57f8 \
  --output /path/to/new-evidence-report.json
```

Archive hashes do not cover every locally reconstructed implicit subtree or independent terrain source. The archive is **not** auto-published to GitHub Pages; the already checked-in partial source tileset is the only asset selected by the Atlas toggle. A future upload must respect public storage permissions, licensing, source geography and repeatable integrity checks.

## 3. GeoBIM IFC-to-geospatial relationships

The existing `scripts/geospatial/ifc_preflight.py` checks source IFC STEP structure, checksum, product GUIDs, declared map conversion, projected CRS and length units using an explicitly installed IfcOpenShell parser. The new `scripts/geospatial/export_reviewed_ifc_glb.py` calls a separately installed, reviewed **IfcConvert** CLI to make a real GLB (no downloads or auto-install), validates GLB header/content, attaches the IFC receipt and registry SHA-256, and accepts only **independently reviewed candidate** IFC GlobalId↔GIS asset links with an evidence digest.

The output geometry remains in `IFC_MODEL_LOCAL` and declares `UNVERIFIED_CONTROL_POINTS`. Do not position a GLB on a parcel, use IFC heights for a hydraulic run or claim per-face BIM feature identity until independent control-point residuals, model-unit transforms, IFC `IfcMapConversion` orientation/offset, CRS, vertical datum/geoid, and per-mesh GUID feature identities have been validated in the renderer.

Official converter usage: https://docs.ifcopenshell.org/ifcconvert/usage

## 4. Station observations, device identity and state history

`backend/app/observation_history.py` takes locally saved official USGS Water Data API OGC latest-continuous response bytes plus a pinned official URL and capture time. It requires enrolled source-backed station IDs, parameter code 00065 (gage height), unit `ft`, timezone-aware observation times, valid finite numeric values and station matching. It supports both the documented `time_series_id` and the legacy response `timeseries_id`, rejecting conflicting identifiers; it emits per-event SHA-256 chains, source digest, provisional approval state and explicit `STALE`/`SOURCE_UNAVAILABLE` states. No hidden datum conversion or forecast occurs.

`backend/app/signed_twin_history.py` is a **server-side primitive**, not an exposed endpoint: HMAC-SHA256 of raw event bytes using a per-device 32-byte-or-longer key supplied in memory; explicit device-to-station enrollment; signed event and timestamp; ±5-minute replay window; unique event IDs; SQLite transactional append-only history, event hash chain, and read-only timeline queries. The source is `DEVICE_SIGNED_NOT_OFFICIAL_USGS`, intentionally not masquerading as USGS. Never embed signing keys in the browser or GitHub Pages.

Full production IoT ingress still requires a reviewed HTTPS/TLS reverse proxy or MQTT broker, device onboarding and secret rotation, service authentication/authorization, rate limits and quota alarms, persistent backups, out-of-band chain checkpoints, and an independent audit. Map to OGC SensorThings `Things`, `Sensors`, `Datastreams`, `Observations`, `HistoricalLocations` and `FeaturesOfInterest` only after source review. See [OGC SensorThings API](https://ogcapi.ogc.org/sensorthings/overview.html), [NIST IoT onboarding](https://csrc.nist.gov/pubs/sp/1800/36/final), [OWASP webhook security](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html).

## 5. Hydrology and scientific forecast release boundaries

`backend/engineering/stage_calibration_gate.py` evaluates **offline observed vs. modeled time series** with exact timestamp pairing, SHA-256 receipts for source CSV files and datum-control artifacts, fixed datum and units per event, *independent* nonoverlapping calibration/validation events, and published user-defined thresholds for RMSE, bias and Nash–Sutcliffe efficiency (NSE). Outputs are at most `CANDIDATE_FOR_INDEPENDENT_REVIEW` and cannot mark `forecastOperational`, `engineeringCertified`, or `regulatoryApproved`.

Calibration skill is **not** established by one matching gage, a single event, synthetic fixture, or an arbitrary threshold. USACE additionally calls for realistic Manning roughness, hydrograph shape, peak timing, volume, stage and discharge ranges, model stability, terrain/channel suitability, mass balance, and unseen event validation. See [HEC-RAS calibration guidance](https://www.hec.usace.army.mil/confluence/rasdocs/rasum/6.4/performing-a-1d-unsteady-flow-analysis/calibration-of-unsteady-flow-models).

Before any evidence-qualified predictive forecast: independently validate watershed boundaries, hydro-meteorological forcings, HEC-RAS geometry and computation output, outlet boundary conditions, temporal alignment, NAVD88 station-zero conversions, terrain/geoid transforms, event-specific data splits, independent observations, uncertainty intervals, and responsible hydrologist sign-off. Until then the Atlas displays source station observations and clearly labeled *non-operational scenarios* only.

## Release checks

The new `.github/workflows/tsm-twin-evidence-contracts.yml` adds isolated offline tests for archive digest/identity checks, IFC source crosswalks, signed sensor replay, official USGS telemetry, and independent-event hydraulic skill. The existing GeoBIM and hydrologic workflows are extended as well. **A passing CI contract is not a headed rendering screenshot, source license approval, complete geospatial survey or commissioned hardware test.**
