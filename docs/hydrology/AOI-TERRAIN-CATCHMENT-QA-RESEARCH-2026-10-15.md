# Home AOI Terrain and Catchment QA Research Note

**Site:** 13101 Bonebank Road, Posey County, Indiana  
**Date:** 2026-10-15  
**Status:** Methodological evidence only; not parcel-specific model validation.

## 1. Verified public-data availability

The USGS The National Map Access API was queried for the candidate parcel bounding box `[-88.0062, 37.8453, -88.0043, 37.8463]`. The API returned four 1-meter DEM products whose published bounding boxes cover the candidate area.

Selected candidate:
- **Product:** USGS 1 Meter 16 x41y419 IN_Indiana_Statewide_LiDAR_2017_B17
- **ScienceBase metadata:** https://www.sciencebase.gov/catalog/item/60e6aebcd34e2a7685d0271b
- **GeoTIFF:** https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1m/Projects/IN_Indiana_Statewide_LiDAR_2017_B17/TIFF/USGS_1M_16_x41y419_IN_Indiana_Statewide_LiDAR_2017_B17.tif
- **Publication date:** 2021-07-04
- **Source acquisition dates:** 2017-03-03 to 2020-04-11
- **Nominal resolution:** 1 meter
- **Surface:** bare-earth DEM
- **Horizontal reference:** NAD83 / UTM, units meters
- **Vertical reference:** NAVD88, units meters

The GeoTIFF could not be downloaded into the current working environment in this run. Consequently, the tile is **catalog-verified but not acquired or QA-checked**. No terrain values, slope, flow accumulation, flow direction, or catchment geometry have been computed from it. USGS metadata warns that tiles are not necessarily seamless across project boundaries.

## 2. Peer-reviewed methods informing quality gates

### Moges et al. (2023)

**“How does the choice of DEMs affect catchment hydrological modeling?”** *Science of the Total Environment*, 892, article 164627. DOI: https://doi.org/10.1016/j.scitotenv.2023.164627

The study evaluates DEM choice for stream/catchment delineation and SWAT streamflow modeling across four regions. It reports significant differences in stream and catchment delineation by DEM choice and lower accuracy for smaller/flatter catchments than larger/steeper ones.

**Project application:** preserve the native DEM metadata; verify flat-terrain flow paths; inspect catchment boundaries and hydrography alignment; compare independent delineation methods; do not treat nominal resolution alone as evidence of suitability.

### Zhu and Chen (2024)

**“A Study of the Effect of DEM Spatial Resolution on Flood Simulation in Distributed Hydrological Modeling.”** *Remote Sensing*, 16(16), 3105. DOI: https://doi.org/10.3390/rs16163105

The study compares flood simulations using DEM resolutions from 30 m to 500 m across three watersheds. It reports resolution-dependent changes in simulation accuracy and identifies water-system extraction and slope reduction among factors associated with accuracy decline.

**Project application:** do not silently resample DEMs; retain resolution and processing lineage; if modeling is later authorized, test sensitivity to terrain resolution and conditioning; treat modeled water depth/velocity as uncertain until validated against observations and suitable reference data.

These studies are not local measurements and do not validate any result for this property. Their findings are used only to justify explicit terrain QA and sensitivity gates.

## 3. Acquisition and processing checklist

1. Download the official GeoTIFF and ScienceBase metadata; record UTC retrieval time, HTTP result, file size, SHA-256, product ID, and source URL.
2. Inspect raster CRS, UTM zone, pixel size, NoData, vertical datum, vertical units, acquisition vintage, and quality/accuracy metadata. Confirm no hidden unit/datum mismatch.
3. Confirm the raster covers the parcel and the surrounding terrain needed for outlet and catchment analysis. Inspect tile seams and any adjoining project tiles.
4. Preserve the original raster. Make a separate working derivative with documented hydrologic conditioning only where justified by culvert/ditch/crossing evidence.
5. Identify the actual receiving ditch, stream, culvert, or outfall. Do not substitute the parcel centroid for an outlet.
6. Generate and review hillshade, slope, flow direction, flow accumulation, and candidate drainage paths. Compare them to current imagery, hydrography, road/ditch/culvert evidence, and field observations if available.
7. Delineate only to a reviewed outlet; save the polygon, area, CRS, method/config, software version, input hashes, and QC map.
8. Compare against USGS StreamStats/current applicable delineation products where available, and document differences rather than averaging or silently choosing one.
9. Keep hydrologic catchment distinct from the property parcel, house footprint, and hydraulic model domain.
10. Keep HEC-HMS/HEC-RAS blocked until the modeling question, outlet, terrain, flow inputs, structures, datum, and review path are approved.

## 4. Current gate state

| Gate | State | Reason |
|---|---|---|
| Candidate parcel/address match | Verified from live IGIO service | Exact parcel ID and situs address match |
| Working parcel point | Selected; legacy point rejected | Legacy point is ~6.42 km away |
| Indiana state floodplain point intersection | Verified, limited | State CSLF polygon returns AE; point intersection only, no BFE |
| 1-meter terrain product availability | Verified from TNM API | Candidate Indiana statewide LiDAR DEM bbox covers parcel |
| DEM acquisition and raster QA | Open | GeoTIFF not downloaded or inspected |
| EPQS elevation value | Quarantined | Research connector unit label conflicts with requested units |
| Effective FEMA panel / BFE / FARA | Open | Current NFHL query not refreshed; INFIP/FARA review still required |
| House footprint and legal parcel boundary | Open | Requires authoritative structure and survey/county evidence |
| Drainage outlet | Open | No verified outlet |
| Catchment | Blocked | Outlet and terrain/conveyance evidence not approved |
| HEC-HMS / HEC-RAS | Blocked, not run | No approved input package or model question |

## 5. Source and connector limits

- Official USGS 3DEP product metadata: https://www.usgs.gov/3d-elevation-program
- USGS EPQS accuracy guidance: https://www.usgs.gov/faqs/how-accurate-are-elevations-generated-elevation-point-query-service-national-map
- USGS 3DHP products: https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products
- Indiana DNR INFIP/FARA guidance: https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/
- Research discovery included SciSpace, Consensus, alphaXiv, and Exa. The Scite connector reported that paid-plan or trial access is required; no Scite-only claim is used. Wolfram's contextual lookup returned no parcel-specific result.
