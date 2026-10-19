# Candidate hydrology AOI — 13101 Bonebank Road

**Status: candidate parcel identified; not approved for hydraulic modeling.**

## Address and parcel evidence

- Address: 13101 Bonebank Road, Mount Vernon, Indiana 47620.
- County: Posey County, Indiana (FIPS 18129).
- Parcel source: Indiana Geographic Information Office (IGIO), *Parcel Boundaries of Indiana 2025*.
- Parcel ID: `65-19-08-100-008.001-010`; state parcel ID: `651908100008001010`.
- Source layer record: object ID `335325`, local ID `15768`, source load date `2025-08-28`.
- Parcel geometry: [candidate parcel GeoJSON](../../../data/posey-county/aoi/13101-bonebank-road-parcel.geojson); SHA-256 `93d9115b21b14932674095b5267b482c9b38c6fc45399687a8b5126894b71572`.
- IGIO source layer: https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0
- Parcel-layer centroid: longitude `-88.00535128`, latitude `37.84579909`.
- Calculated parcel polygon area: approximately 2.4453 acres (0.00989575 km²), geodesic area from the published parcel polygon; not surveyed legal acreage and **not** watershed area.

The parcel polygon is suitable as a *site candidate footprint only after the location discrepancy is resolved*. Until then, do not treat the address-to-parcel association as verified. It is not a drainage catchment, a HEC-HMS basin boundary, a HEC-RAS 1D/2D computational domain, or a surveyor-certified boundary.

## Critical location discrepancy

Existing repository records also assert a second “surveyed centroid” at longitude `-88.0007`, latitude `37.9035`, approximately **6.4 km** from the IGIO parcel centroid above. These coordinates are not interchangeable. Until a licensed survey, authoritative parcel documentation, or owner-confirmed site record resolves the discrepancy, the address-to-parcel association and all point-dependent analysis remain **unverified**. The USGS elevation and FEMA/Indiana DNR point intersections below apply only to the IGIO parcel centroid used for those queries; they must not be attributed to the conflicting point or assumed to represent a structure.

See the full [candidate AOI report](../AOI-REPORT-13101-BONEBANK-ROAD-2026-10-15.md) for the coordinate conflict and evidence-gated next steps. Also see the [completion checklist](../AOI-COMPLETION-CHECKLIST-13101-BONEBANK-ROAD-2026-10-15.md) and [machine-readable source register](../../../data/posey-county/evidence/13101-bonebank-road-source-register-v1.json).

## Authoritative terrain and flood-data observations

1. **USGS 3DEP / Elevation Point Query Service:** the parcel-layer centroid query returned 361.9984 ft NAVD88 with reported 1 m source resolution. This is one interpolated point sample, not a terrain surface or a verified building/ground elevation. Source endpoint: https://epqs.nationalmap.gov/v1/json
2. **FEMA National Flood Hazard Layer:** the parcel centroid intersects an NFHL polygon classified Zone AE and Special Flood Hazard Area. The queried `STATIC_BFE` was `-9999` and the response supplied no vertical datum, so the result does **not** establish a usable Base Flood Elevation (BFE). Verify the effective map panel and Flood Insurance Study in the [FEMA Map Service Center](https://msc.fema.gov/portal/home).
3. **Indiana DNR / IGIO flood-hazard layer:** an independent state-layer point query also reports Zone AE / SFHA. BFE, depth, and velocity fields were `-9999` no-data sentinels and are normalized to null in the evidence record. See the [Indiana Floodplain Information Portal](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/) and [Indiana Best Available Floodplain Mapping](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/the-indiana-best-available-floodplain-mapping/).

The point intersections are useful screening evidence. They do not establish how much of the parcel is in a mapped zone, flood depth at the structure, a floodway determination, a site-specific BFE, or a regulatory conclusion. FEMA effective mapping and Indiana DNR best-available mapping are distinct products and must remain distinct in TSM.

## Hydrology / HEC model readiness

The source-backed record is [site AOI evidence v1](../../../data/posey-county/evidence/13101-bonebank-road-site-aoi-v1.json). The candidate run manifest is [HEC coupled-run manifest v2](../../../data/posey-county/hec/13101-bonebank-road-candidate-run-manifest-v2.json); it is intentionally marked `DRAFT` and must fail execution readiness.

**Not yet supplied or qualified:**

- An approved hydraulic point of interest/outlet and independently reviewed watershed delineation.
- A source-backed rainfall/event dataset, loss method and parameters, transform/routing choices, antecedent conditions, and calibrated/validated HEC-HMS basin model.
- A surveyed or otherwise qualified HEC-RAS terrain surface, breaklines, channel/bathymetry, structures, mesh/cross-sections, roughness, downstream/upstream boundary conditions, and datum reconciliation.
- Exact installed HEC-HMS and HEC-RAS versions/platforms, source project packages, executable hashes, DSS record identifiers, and a tested run environment.
- Observed event data and independent calibration/validation, uncertainty analysis, and qualified engineering review.

Use USGS StreamStats only after selecting and documenting the relevant outlet, then inspect the delineation against current 3D Hydrography Program data and suitable terrain. A DEM-derived basin must be reviewed; do not infer the watershed from the parcel polygon.

## Reproducibility controls

The HEC workflow uses manifest v2, exact commit binding, pinned project/runtime/adapter hashes, explicit DSS FLOW pathname and units, resilient gap handling, isolated run copies, content-addressed artifacts, and a handoff receipt. HEC-HMS/HEC-RAS computations, validation, and approval are separate states; this candidate address does not authorize a run.

Official references:
- [USGS Water Data APIs](https://api.waterdata.usgs.gov/docs/ogcapi/)
- [USGS 3D Hydrography Program](https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products)
- [USGS StreamStats delineation documentation](https://streamstats.usgs.gov/ss-delineate/docs)
- [HEC-HMS documentation and current release notes](https://www.hec.usace.army.mil/software/hec-hms/documentation.aspx)
- [HEC-RAS documentation](https://www.hec.usace.army.mil/software/hec-ras/documentation.aspx)
