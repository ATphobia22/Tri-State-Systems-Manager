# Home Hydrology AOI Readiness — source evidence and release gates

**Assessment date:** 2026-10-18  
**Status:** research and source inventory complete; AOI-specific hydraulic model readiness is **not established**.  
**Primary region context:** lower Wabash–Ohio River confluence / Posey County, Indiana. No parcel or project AOI is approved by this document.

## 1. Regional engineering evidence

The supplied USACE ERDC/CHL TR-22-4 report, *Wabash and Ohio River Confluence Hydraulic and Sediment Transport Model Investigation* (Bell, Abraham, Clifton, and Lamkin; February 2022), reports that Wabash River channel avulsions during 2008–2011 contributed to shoaling in the Ohio River. USACE developed a two-dimensional Adaptive Hydraulics (AdH) model for base conditions and alternatives, using field-collected multibeam bathymetry, bed and suspended sediment samples, discharge, and velocity measurements. The report describes Phase 1 (2013–2015) and Phase 2 (2018–2020) investigations, with a two-year simulation of the observed hydrograph from 2015-09-26 to 2017-09-26.

The report states its Phase 1 horizontal coordinates are UTM Zone 15 North, NAD83, metres. It uses the local “Ohio River” vertical datum; at J. T. Myers Locks and Dam the report relates that datum to NGVD29 -0.35 ft and directs readers to USACE Louisville District for current information at other Ohio River locations. **Do not assume this is NAVD88, do not apply that local relation to an arbitrary gage or parcel, and do not use report elevations as present-day terrain.** The study is a strong regional model/validation reference, but its domain, historical bathymetry, boundary conditions, and alternatives are study-specific.

Official report record: https://doi.org/10.21079/11681/43441

## 2. Existing local evidence to prioritize

1. **USGS New Harmony gage 03378500** — official station page: https://waterdata.usgs.gov/monitoring-location/USGS-03378500/. Keep discharge, gage height, gage-zero conversion, and station altitude as distinct fields.
2. **USGS SIR 2016-5119** — https://pubs.usgs.gov/publication/sir20165119. It describes flood-inundation maps for a 3.68-mile reach extending 1.77 miles upstream and 1.91 miles downstream from gage 03378500. Profiles are referenced to the station datum. This is useful comparison evidence only inside its documented reach and stage range.
3. **USGS modern Water Data APIs** — https://api.waterdata.usgs.gov/docs/. Use the modern OGC API contracts; the legacy WaterServices family is scheduled for decommissioning on 2027-02-22. USGS announced staged degradation beginning 2026-11-16; migrate before that date to avoid latency and outages. Capture UTC time, parameter code, units, approval/provisional status, qualifier, source ID, and retrieval time.
4. **USGS Real-Time Flood Impacts** — https://api.waterdata.usgs.gov/rtfi-api/docs. Surveyed infrastructure impact points can add context, but USGS marks these data provisional and they are not a universal safety certification.
5. **USGS NHDPlus HR** — https://www.usgs.gov/national-hydrography/nhdplus-high-resolution. Use flowline/catchment context for watershed screening; a final AOI watershed requires geometry-specific delineation and QA.
6. **FEMA effective NFHL/FIRM/FIS** — https://msc.fema.gov/portal/home. Record effective date, panel, FIS identifiers, and product lineage.
7. **Indiana DNR INFIP/FARA and Best Available mapping** — https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/. Preserve the distinction between Indiana planning/regulatory context and FEMA effective flood insurance mapping.
8. **USACE National Levee Database** — https://levees.sec.usace.army.mil/data-services/services/. Levee inventory presence is not evidence of accreditation, performance, or protection at a site.
9. **USGS 3DEP terrain** — https://www.usgs.gov/3d-elevation-program-standards-and-specifications. Select a product whose native horizontal CRS, vertical datum, acquisition date, resolution, and coverage are verified from its metadata.

## 2A. Existing home-AOI candidate: unresolved location and elevation limits

The repository's candidate report for the Bonebank Road site records a candidate IGIO 2025 parcel footprint of approximately 2.4453 acres, but explicitly marks the address-to-parcel association unverified. Its parcel centroid is longitude -88.00535128, latitude 37.84579909. A separate legacy “surveyed centroid” is longitude -88.0007, latitude 37.9035—approximately 6.4 km away. These points are not interchangeable; no point-dependent result should be attributed to the structure until the discrepancy is resolved by authoritative parcel/site documentation or qualified survey evidence.

Existing screening observations are similarly bounded: the USGS EPQS point query returned 361.9984 ft NAVD88 at the parcel centroid, but that is a single interpolated point, not a terrain surface or verified building/ground elevation. FEMA NFHL reports a Zone AE / SFHA intersection, but `STATIC_BFE=-9999` and no vertical datum were supplied; the state flood-hazard point query likewise returned no-data sentinels for BFE/depth/velocity. Therefore, **no usable site-specific BFE, flood depth, or design elevation is established**. See the [candidate AOI evidence report](aoi/13101-BONEBANK-ROAD-CANDIDATE.md).

### ERDC coordinate-reference discrepancy to resolve

ERDC/CHL TR-22-4 text states UTM Zone 15 North, NAD83, metres for the Phase 1 model. The Wabash–Ohio confluence lies near 87.8°W, geographically within UTM Zone 16N (the 90°W–84°W zone). Treat the report's written CRS declaration as a source claim that requires confirmation—not as a corrected or silently interchangeable CRS. Before reusing model geometry or elevations, inspect original model files/control points and obtain USACE clarification on the intended projection and vertical datum. Do not transform, overlay, or combine the model with current AOI layers until this discrepancy is resolved.

## 3. Hard gates before a site-level run

- [ ] Confirm address, parcel boundary, jurisdiction, and AOI polygon; retain the geocoding method and uncertainty.
- [ ] Verify AOI coverage and product vintages for effective FEMA mapping, state floodplain mapping, terrain, hydrography, levee records, and relevant historical studies.
- [ ] Establish horizontal CRS and vertical datum for every elevation-bearing source. Record the exact geodetic transformation/model, grid/version, and uncertainty if a conversion is needed.
- [ ] Acquire current gage observations/forecasts only through explicitly enabled, tested adapters. Distinguish observation, forecast, model output, historical map, and regulatory product.
- [ ] Obtain bathymetry where channel hydraulics materially affect the result; a bare-earth DEM alone is not channel bathymetry.
- [ ] Define rainfall/inflow/outflow boundary conditions, roughness, structures, mesh/resolution, hydro-conditioning, calibration/validation evidence, sensitivity analysis, and uncertainty.
- [ ] Validate model outputs against independent observed high-water marks, stage/discharge, surveyed cross sections, or suitable published flood-inundation products.
- [ ] Emit a provenance manifest with source URL, acquisition/retrieval time, product date, checksum, CRS, vertical datum, units, transformations, model/software version, scenario, and reviewer state.
- [ ] Keep outputs labelled screening/model evidence until a qualified reviewer approves the scope and results. Never infer design elevations, regulatory determinations, or safe/unsafe conclusions from a map overlay alone.

## 4. Runtime state is not source availability

The source catalog, tile manifest, and runtime registry must agree. NOAA NWPS is currently marked retired by the repository's owner-decision registry, so a catalog entry cannot claim it is published/current operational truth. The modern USGS API is publicly documented, but that does not override the repository's explicit telemetry gate or prove that an endpoint, AOI, units, freshness policy, and runtime integration have passed tests.

## 5. Release decision

**Current disposition: AOI readiness = BLOCKED / NOT APPROVED.** Regional literature and public source discovery are useful, but there is no approved AOI polygon, verified site-specific data package, current end-to-end live-source test receipt, or validated model run in this report. This is an evidence-based block, not a claim that the public datasets do not exist.
