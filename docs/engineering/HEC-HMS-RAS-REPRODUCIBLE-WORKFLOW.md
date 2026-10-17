# Reproducible HEC-HMS → HEC-RAS pilot workflow

## Status and guardrails

TSM defines a strict JSON Schema Draft 2020-12 manifest, an external-readiness validator, a UTC hydrograph exchange contract, and a content-addressed artifact-store interface. The checked-in example is deliberately **NOT_APPROVED**, uses placeholder hashes and paths, and is not executable.

No licensed HEC-HMS/HEC-RAS runtime or approved watershed project is bundled. Do not invent an area, rainfall, model parameters, vertical datum, or boundary conditions. A real solver run requires an authorized AOI approval record, reviewed project inventories, version-pinned tested adapters, and qualified engineering oversight.

## Candidate site: 13101 Bonebank Road, Mount Vernon, Indiana

The user-selected address has been matched to one record in the Indiana Geographic Information Office's **Parcel Boundaries of Indiana 2025** layer. The site-specific evidence is recorded in `data/posey-county/evidence/13101-bonebank-road-site-aoi-v1.json`; the exact source parcel ring is saved as `data/posey-county/aoi/13101-bonebank-road-parcel.geojson`. The geometry is pinned by SHA-256 and tested against `data/schemas/posey-site-aoi-v1.schema.json`.

| Field | Observed value |
|---|---|
| County | Posey County, Indiana (FIPS 18129) |
| IGIO parcel ID | `65-19-08-100-008.001-010` |
| State parcel ID | `651908100008001010` |
| Parcel-layer centroid | 37.84579909° N, -88.00535128° W |
| GIS-vertex geodesic area estimate | 9,895.75 m² / 2.4453 acres |
| USGS EPQS point sample | 361.998 ft, queried from 3DEP at centroid; NAVD88 per EPQS contract |
| FEMA NFHL centroid intersection | Zone AE; Special Flood Hazard Area = true |
| Usable Base Flood Elevation (BFE) from point response | **Not available**; raw `STATIC_BFE=-9999`, datum null |

Sources: [Indiana IGIO parcel layer](https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0), [USGS Elevation Point Query Service / National Map](https://www.usgs.gov/the-national-map-data-delivery/gis-data-download), [FEMA National Flood Hazard Layer](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer), [FEMA Map Service Center](https://msc.fema.gov/portal/home), and [Indiana DNR Best Available Flood Hazard layer](https://gisdata.in.gov/server/rest/services/Hosted/FLOODHAZARD_DNR_WATER_PROD/FeatureServer/0).

**Coordinate reconciliation:** the repo's historical `docs/OWNER-ACTION-REQUIRED.md` records a conflicting PTDT v35 point (37.9035° N, -88.0007° W) about 6.42 km from this address-matched parcel. The user's 2026-10-15 instruction selects the supplied street address for this candidate AOI; TSM uses the matching IGIO parcel polygon only and does not use that legacy point. This is a workflow site selection—not a survey certification. The legacy coordinate must not be used as a design input unless an authoritative survey/owner record reconciles it.

**Parcel-level flood intersection:** an additional query with the full source polygon (rather than the centroid point) also returned the same Zone AE / SFHA feature from FEMA NFHL and Indiana's DNR/IGIO layer. The services returned no intersected geometry, so the share of parcel area affected is unknown; no usable BFE, depth, or velocity was returned. The query/provenance metadata is saved under `fema_nfhl_parcel_intersection` and `indiana_dnr_parcel_intersection` in the evidence JSON.

**Regional watershed context:** the parcel and centroid are in USGS WBD HUC12 `051201130904`, `Willow Pond Slough-Wabash River`. This is a regional reporting boundary, not the local contributing catchment or the correct HEC-HMS basin area; the local outlet and drainage boundary remain undelineated.

**Interpretation limits:** the geometry is a state parcel GIS polygon, not a boundary survey. The Zone AE result is a point intersection at the parcel-layer centroid and should be checked against the effective FEMA map products; it does not establish the percentage of the parcel in that zone, a site-specific flood depth, or structure-level risk. The returned `-9999` BFE/depth/velocity values are no-data sentinels, not measurements. The USGS elevation is a single interpolated point sample, not a terrain surface suitable for a hydraulic mesh.

**This parcel is not the HEC-HMS watershed.** A real coupled run still requires a selected and reviewed flow outlet; a checked drainage basin delineation; site-relevant terrain/hydrography; a supported rainfall hyetograph; actual HMS and RAS project packages; pinned/tested solver and DSS-transfer adapters; compatible horizontal CRS/vertical datum; and calibration, independent validation, uncertainty analysis, and qualified engineering review. USGS provides [StreamStats delineation services](https://streamstats.usgs.gov/ss-delineate/docs) and [3D Hydrography Program data](https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products). USGS cautions that DEM-derived boundaries need checking, particularly in flat terrain.

The evidence record is intentionally **USER_SELECTED_CANDIDATE_NOT_ENGINEERING_APPROVED**. Watershed area/outlet remain null; HEC-HMS and HEC-RAS execution are both `NOT_RUN`. Do not use this parcel polygon as an HMS basin, RAS inundation domain, or claim of an engineering-approved AOI.

## Source integration research

- [HEC-HMS official software and documentation](https://www.hec.usace.army.mil/software/hec-hms/): use documentation matching the installed release.
- [HEC-HMS Technical Reference Manual (2023-10-18)](https://www.hec.usace.army.mil/software/hec-hms/documentation/HEC-HMS_Technical_Reference_Manual-20231018.pdf): hydrologic methods reference, not a substitute for current version documentation.
- [hms-commander on PyPI](https://pypi.org/project/hms-commander/) and [source](https://github.com/ATphobia22/hms-commander): candidate automation/DSS adapter. Pin an immutable release/commit and test against the actual software/DSS versions before production use.
- [HEC-Commander tools](https://github.com/ATphobia22/HEC-Commander): reference notebooks and scripts, not an audited production dependency.
- [Rainfall-runoff tutorial](https://www.researchgate.net/profile/Shanbor-Kurbah/publication/335739185_Rainfall-Runoff_Modeling_using_HEC-HMS_model_Basic_Manual_Tutorial_for_Beginners/links/5d789af9299bf1cb809827b4/Rainfall-Runoff-Modeling-using-HEC-HMS-model-Basic-Manual-Tutorial-for-Beginners.pdf): educational background only, not a source for local parameters.
- [NWS Radar FAQ](https://www.weather.gov/radarfaq): operational radar product definitions and GIS access; radar is one observation source, not an approved design hyetograph by itself.

## Pilot setup

1. Select an AOI through the project's authorized governance process; save source geometry, provenance, reviewer, timestamp, and approval evidence.
2. Independently delineate and check watershed area. Record horizontal CRS and vertical datum; do not assume they match between model packages.
3. Inventory the actual HMS/RAS project dependencies and hash every listed file. Pin solver versions, the TSM source commit, adapter versions, and command arguments.
4. Review rainfall/meteorology, basin topology, loss/transform/baseflow/routing methods, time step, units, control period, terrain, geometry, mesh, structures, roughness, and boundary conditions.
5. Validate DSS pathname/units/time interval and gage-to-boundary mapping. The CSV validator checks format and trapezoidal volume only; it does not prove DSS equivalence or hydrologic correctness.
6. Run calibration and independent validation against qualified, provenance-bearing observations. Document metrics, uncertainty, mass balance, solver warnings, and qualified engineering disposition.

## Current implementation boundary

`backend/engineering/hec_hms_ras_workflow.py` provides manifest validation, path-safe model inventory checks, AOI ring checks, UTC hydrograph CSV validation, a local content-addressed artifact store, shell-free argv execution, and an adapter-driven orchestration path for HMS → DSS transfer → RAS. Invoke `python -m backend.engineering.hec_hms_ras_workflow MANIFEST --validate-only` to inspect readiness, or `--run` only after a qualified team has configured and tested the actual adapter commands. The runner stages copies of the model packages, removes stale transfer/result targets before execution, records logs and artifact hashes, and retains a receipt. This interface is not evidence that any solver adapter is installed or that the project is scientifically valid. A zero exit code or present HDF5 file must never be interpreted as validated flood predictions.

Local file URIs are not shared durable storage. Configure a shared filesystem or object store before multi-worker deployment, and retain immutable input/output hashes and human-review records.
