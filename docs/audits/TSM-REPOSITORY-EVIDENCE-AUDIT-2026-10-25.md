# TSM Repository-Wide Evidence Audit — 2026-10-25

Reference base: main commit 39f81533cda0298934a0843b6da2bb99cbfc458d.  
Scope: repository inventory and targeted checks of primary government-data, scientific solver, geospatial, native, offline and release paths. This is NOT an exhaustive per-line review of the approximately 9,500-file repository or an engineering certification.

## Verified implementation inventory

| Domain | Existing code or data | Validation boundary |
| --- | --- | --- |
| Platform | 48 package directory entries, including government, geo, hydraulics, model, policy, evidence, and twin modules | Framework/package presence is not operational acceptance |
| Web and API | React/TypeScript console, Node ingestion runtime, separate FastAPI companion service | Companion API is not yet wired into primary Node API per its README |
| Government GIS | Posey county boundary, parcels, elevations, watersheds, floodplain data, authoritative-source inventory and downloader | A cached floodplain file includes adjoining counties despite its Posey filename; require exact geometry and coverage |
| Observations | USGS modern OGC v1 latest-continuous adapter and legacy snapshot tooling | Source time, approval flags and gage-height datum must be checked independently |
| Hydrology | HEC-HMS, HEC-RAS, DSS handoff, provenance-aware coupled runner and model-archive validation | Installed HEC vendor binaries, project packages, hydrologic AOI, real forcing and calibration remain separate |
| Native | Unreal 5.8 project, native C++ runtime and 18 plugin directories | A verified Windows installer, device visual test and complete offline data staging are not established here |
| Terrain | Transvoxel, 3D Tiles, building LOD, meshlet/GPU scaffolds and validation reports | Full-county adaptive topology, GPU visibility and broad device acceptance remain incomplete |
| Evidence | Schema, geodesy, provenance, hash-checking and regulatory gates | Automated checks do not issue FARA, LOMA, no-rise or agency decisions |

## Source-acquisition defects identified and fixed in this PR

1. The existing Posey PowerShell verifier did not independently recompute every acquired file's SHA-256 against the receipt. The new Node integrity gate checks bytes, hashes, file signatures, real JSON/NDJSON structure and counts, duplicate IDs/paths, symlink/path traversal, and required-source completeness.
2. The recorded county boundary filename and associated 2026 source URL contradicted the actual committed 2023 TIGER/Line boundary. The downloader now records the real output name and 2023 source.
3. The previous verifier treated some required IGIO sources as optional merely because their minimum feature count was zero. Only an explicitly non-required source may now remain unavailable in a promotable full bundle. Unavailable required source blocks only the release of that bundle; unrelated app functionality should stay available with truthful degraded status.
4. Historical daily-mean USGS acquisition used the legacy WaterServices daily-values endpoint. A new OGC API v1 acquisition path requests USGS-03378500 daily mean discharge (parameter 00060, statistic 00003), handles source pagination, retains quality/approval metadata, and writes a provenance sidecar with page and product digests.
5. Fresh historical data remain ACQUIRED_UNVERIFIED until source identity, coverage, file integrity and relevant scientific QA are completed. No synthetic observations or unapproved AOI are inserted.

## Remaining scientific and release gates

- Offline holdings: the inspected Posey offline source folder contained only an acquisition manifest and FEMA panel reference JSON, not a full, independently verified receipt for every required source. A manifest is not proof of downloaded bytes.
- AOI: a verified parcel geometry or hydrologic-unit outline is not a validated contributing catchment. An HEC project needs a reviewed watershed, forcing, structures, bathymetry, geometry and solver configuration.
- Solver execution: existence of HEC adapters does not prove vendor software installed, a real coupled run completed, mass balance verified, or calibration established against independent measurements.
- Datums: no conversion from gage stage to NAVD88 is permissible without independently verified gage-zero evidence, applicable transformation and units. Full coordinate/vintage quality coverage still has reported gaps.
- Flood hazard: effective FEMA NFHL, Indiana DNR Best Available mapping and FARA/local determinations must remain separate authority classes.
- USACE ERDC/CHL TR-22-4: its AdH confluence/sediment calibration is study-specific reference evidence, not transferable site-specific HEC calibration.
- Native release: Unreal 5.8 Windows packaging, full offline data staging, installer hashes and physical-device performance remain subject to their own measured gates.
- Live acquisition: new USGS OGC v1 history code was tested against injected source-shaped fixtures but was not used here to claim a downloaded official archive.

## Next evidence-required engineering sequence

1. Complete PR CI on the exact head SHA; repair any genuine failures without changing scientific acceptance criteria.
2. Acquire missing datasets from original agencies and verify all independent checks, exact-county geometry, source vintages, CRS and vertical datums; publish only validated artifacts.
3. Obtain a site-specific, reviewed hydrologic AOI and run pinned HEC-HMS/HEC-RAS with real input artifacts; preserve solver/environment and output digests.
4. Compare independent observed stages/flows, sensitivity, mass balance and uncertainty before claiming validated model predictions.
5. Produce verified native UE Windows outputs, offline installer, visual frame validation and reproducible evidence inventory.

## Authorities / external references

USGS modern Water Data API: https://api.waterdata.usgs.gov/docs/ogcapi/  
USGS WaterServices retirement: https://waterdata.usgs.gov/blog/api-waterservices-decom  
USGS SIR 2016-5119: https://doi.org/10.3133/sir20165119  
USACE ERDC/CHL TR-22-4: https://doi.org/10.21079/11681/43441  
Indiana DNR INFIP: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/

Source material and confidence levels are deliberately distinguished: a test is not a live retrieval; a retrieval is not calibration; a model run is not independent validation; and scientific validity does not by itself confer regulatory authority.
