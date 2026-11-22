# Public Atlas, native direct-file and HEC-RAS evidence gates
2026-11-22 | Tri-State Systems Manager | NOT RELEASE-CERTIFIED

This is a record of bounded implementation, sources and outstanding independent evidence. No self-reported checksum, simulated observation, successful CI workflow or hosted browser prompt is an engineering certification.

## Gate A: Public Atlas, Cesium and navigable fallback

Official deployment: https://atphobia22.github.io/Tri-State-Systems-Manager/atlas/

On 2026-11-22 an independent hosted browser displayed a WebGL2 compatibility error with no map canvas. That describes the tested browser environment, not a general production outage. No headed Cesium building/terrain/cinematic verification could be established through that browser.

Implemented: AtlasGraphicsGuard probes browser WebGL2 before mounting the map. Without graphics it exposes nonvisual access to River Watch, the Beverly Ann Tucker Memorial and evidence/architecture pages, and explicitly states that terrain, buildings, flood overlays and cinema have not rendered. Regression: tsm-console/cypress/e2e/atlas-webgl-fallback.cy.ts.

Needed for independent public release:
1. Real headed WebGL2-capable browser and anonymous production URLs: /atlas, /cesium, /map, /river-watch, /memorial and /cinematic-engineering.
2. Screenshot + console/network logs + device/GPU and UTC timestamps, including actual source tile and station responses.
3. Confirm 3D terrain and buildings are loaded as geometry, not just checkbox labels. Report genuine source coverage and valid height inventory.
4. Expand and collapse flood layers and regulatory/planning distinction (FEMA NFHL versus BAFL), request USGS gauges and inspect stale states.
5. Run, stop and restore cinematic navigation without occlusion. Verify memorial direct links and accessible controls.
6. Never equate test fixtures, abstract canvas elements or a successful build with real geospatial data.

## Gate B: UE5.8 offline direct-file observations

Existing verified pipeline:
USGS source capture -> full station and UTC preflight -> offline bundle -> local source replay -> offline view.

This PR adds twin.native_gauge_export, a bounded two-file, local SHA-256 handoff:
Content/TSMData/observations/gauge-view.json
Content/TSMData/observations/gauge-view.receipt.json

UTSMOfflineGaugeReader (UE5.8 C++) reads these exact packaged paths, checks bytes, hash, schema, station identity, series, timestamps, finite stage heights and unresolved USGS gage datum. Recency is recalculated against the native host UTC clock. UTSMExperienceSubsystem::InspectLivingRiverValley now surfaces gauge readings and a separate LOCAL checksum status to Blueprints. No runtime Python, WebView, Node, HTTP or localhost service is involved.

Build-time staging on a Windows machine with Python dependencies installed:
    pwsh -File scripts/native/Stage-OfflineGaugeView.ps1 -VerifiedObservationBundle C:\data\verified-usgs

For deterministic test replay, pass -AsOfUtc 2025-01-01T13:01:00Z. Real releases must use a fresh, verified capture; synthetic fixtures must never be distributed as actual telemetry.

Service checks from services/living-twin:
    python -m twin.native_gauge_export verify ../../tsm-native/Content/TSMData/observations
    python -m pytest -q tests/test_offline_bundle.py tests/test_offline_view.py tests/test_native_gauge_export.py

The local receipt is unsigned: tampering with receipt AND view is not prevented by the SHA. A trusted installer chain, release signature, independent source provenance, vetted real data and clean Windows 11 x64 air-gapped Shipping startup are still required. A compile-time or npm test does not satisfy these gates. Runtime must prove local assets loaded and observe process list, FPS, VRAM, log and no network.

## Gate C: HEC-RAS versus observed water levels

Existing read-only HDF5 tooling:
- backend/engineering/hecras_hdf5.py
- tsm_runtime/hec_ras_hdf5_extractor.py

Existing datum-safe O/H comparison: services/living-twin/twin/hydrology_validation.py.

This PR adds twin.hec_release_gate, a headless audit of:
- exact SHA-256 for geometry, plan, flow, terrain and model HDF5;
- model revision identity, HEC-RAS solver version and explicit CRS/NAVD88 feet;
- externally documented AOI/watershed approval and HDF extraction review;
- station, UTC skew, USGS parameter 00065, stage, gage-zero datum and effective time;
- complete observation/model/datum uncertainty;
- disjoint calibration and independent holdout observations with approved holdout quality;
- descriptive MAE, RMSE, signed bias, maximum absolute error and NSE (when defined).

Tool command (from services/living-twin):
    python -m twin.hec_release_gate path/to/model-manifest.json path/to/paired-events.json --model-root path/to/real-hec-run --gage-zero path/to/reviewed-datum-by-station.json

The code always blocks regulatory publication and engineering certification even if the structural comparison is review-ready. The HDF parser and solver must independently reproduce time/cell results, calibrate against separate events, and be checked by a qualified reviewer. This audit does not authenticate USGS/USACE source and cannot verify a reviewer claim by reading a metadata field.

The Google Drive technical specification hec-release-gates-spec.md records the Posey pilot AOI as NOT APPROVED due to incomplete watershed delineation. No actual independent Posey model/HDF5 execution, bench-tied station gage-zero record or signed engineering approval was established in this session.

## Official and peer-reviewed methodology

- USACE HEC-RAS 6.6 unsteady calibration:
  https://www.hec.usace.army.mil/confluence/rasdocs/rasum/6.6/performing-a-1d-unsteady-flow-analysis/calibration-of-unsteady-flow-models
- USACE HEC-RAS 2D HDF5:
  https://www.hec.usace.army.mil/confluence/rasdocs/r2dum/6.4/viewing-2d-or-1d-2d-output-using-hec-ras-mapper/2d-output-file-hdf5-binary-file
- HEC-RAS Mapper evaluation / Reference Locations:
  https://www.hec.usace.army.mil/confluence/rasdocs/rmum/6.6/mapping-results/evaluating-ras-results
- USGS Water Data OGC:
  https://api.waterdata.usgs.gov/docs/ogcapi/
- Sharma & Regonda, Two-Dimensional Flood Inundation Modeling in the Godavari River Basin, India—Insights on Model Output Uncertainty, Water (2021):
  https://consensus.app/papers/sharma-regonda-twodimensional-flood-inundation-modeling-in-the/w:71338f4f-df37-41f5-88f1-25d57948ca9e/

## Final release verdict

The changes add working code paths and CI-contract tests; they are not proof of actual Countywide 3D Tiles completeness, real-time authoritative gauges, physical hydraulic model certification or a Windows 11 UE5.8 air-gapped Shipping installation. Leave those independent gates pending until actual release artifacts, GPU browser evidence and qualified source review exist.
