# Posey FEMA-effective polygon evidence capture (2026-11-16)

**Status: FEMA map evidence for case preparation.** An official NFHL record establishes the mapped designation for its source vintage. A claim that a home was mislabeled needs evidence specific to that home.

## Verified FEMA inputs

Official service: https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer

- FIRM Panels (layer **3**, S_FIRM_Pan): a live query on November 16, 2026 for DFIRM_ID = 18129C returned **35** panels. An attribute query returned the same 35 IDs as the pinned September 30 panel registry and effective date **November 5, 2014**. [Live count](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/3/query?where=DFIRM_ID%3D%2718129C%27&returnCountOnly=true&f=json).
- Flood Hazard Zones (layer **28**, S_Fld_Haz_Ar): a live query for the same DFIRM_ID returned **123** polygon features. [Live count](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?where=DFIRM_ID%3D%2718129C%27&returnCountOnly=true&f=json).
- Actual sampled GeoJSON attributes include FIRM_PAN, EFF_DATE, OBJECTID, FLD_ZONE, ZONE_SUBTY, SFHA_TF and STATIC_BFE. A null datum or sentinel STATIC_BFE = -9999 must **not** be converted into a regulatory flood elevation.
- LOMAs live in layer **34** and LOMRs in layer **1**, corrected in PR #621 on main; these are map changes, not flood-zone polygons. Parcel-specific historical amendments must be reviewed separately.

The acquisition run, frozen geometry archive, and parcel screening counts appear below.

## New headless reproduction path

The software captures official FEMA GeoJSON geometries using an exact DFIRM_ID filter, queries source object IDs and the independent source count, verifies all source OBJECTIDs and county IDs, bounds each download, and writes per-chunk SHA-256 receipts. It rejects missing/duplicate features, unexpected CRS or schema, truncated chunks, and edited files. Retrieval and rendering remain separate.

Acquire:

    python tools/geospatial_exchange/posey_nfhl_effective_geometry.py acquire \
      --out /tmp/posey-nfhl-20261116 --page-size 10

Verify independently without the network:

    python tools/geospatial_exchange/posey_nfhl_effective_geometry.py verify \
      --snapshot /tmp/posey-nfhl-20261116

Screen Posey parcel areas against the verified NFHL snapshot:

    python -m pip install shapely==2.0.6 numpy==2.1.3
    python tools/geospatial_exchange/posey_nfhl_effective_geometry.py screen \
      --snapshot /tmp/posey-nfhl-20261116 \
      --parcels data/posey-county/parcels/posey-parcels-2025.geojson \
      --registry data/posey-county/offline/2026-09-30/fema-effective-firm-panels-18129C.json \
      --out /tmp/posey-fema-screening.json

A parcel only receives positive/negative FEMA-SFHA **area-overlap** status if the complete panel and flood-zone polygon inventory covers its geometry. Missing boundaries, invalid geometry, missing source IDs, unknown zone flags or disagreements with the previous 35-panel inventory produce explicit REVIEW/INCOMPLETE results. Boundary contact alone is not positive-area overlap. The parcel report never invents BFE, LAG, legal grade, fill history, survey accuracy, or an NFIP regulatory result.

The new workflow saves source geometries, their manifests, and the parcel report as a separately downloadable **Actions artifact** after a successful live job. No such artifact should be claimed until checked against the actual workflow run, source checksums and complete list of 35 panels/123 current hazard records.

## What evidence can demonstrate a possibly erroneous FEMA classification?

For each property, retain exact parcel and building-footprint identity, the controlling FEMA effective panel/version and any LOMCs, the structure/SFHA overlap geometry, zone/floodway, valid local BFE source, surveyed or eligible LiDAR-based ground elevations (not roof heights), horizontal/vertical datum, independent survey accuracy or applicable LiDAR quality evidence, and an identifiable owner-authorized FEMA application route. A DNR BAFL/FEMA NFHL difference by itself is **not** proof of an error.

FEMA's [November 2024 MT-1 Technical Guidance, Section 5](https://www.fema.gov/sites/default/files/documents/fema_guidance_mt-1_technical_guidance_nov_2024.pdf) allows certain LOMA requests using publicly accessible government LiDAR at USGS Quality Level 3 or better. FEMA's published procedure deducts **2 feet** from the lowest appropriate LiDAR point for LAG/LLE; for contours, it deducts the greater of half the contour interval or **1 foot**. Do not apply the 2-foot deduction to a parcel-centroid DEM, publish an automatically adjusted regulatory LAG, or assume LiDAR is allowed for a request involving fill, a regulated floodway, conditional requests, Zones AO/AR/A99, and other excluded categories. FEMA considers existing certified elevations and can require new certified measurements.

## Subsurface evidence is context, not FEMA elevation proof

TSM already has a Posey subsurface context join. Authoritative sources:

- [Indiana DNR Water Well Search Help](https://www.in.gov/dnr/water/ground-water-wells/water-well-record-database/database-search-help/) explains that **UTM Only is not field verification**. Estimated as well as verified records may have UTM coordinates; historical DNR database UTM coordinates use NAD27, Zone 16. Use the recorded location-method field, not coordinate presence, and preserve transformation provenance.
- [DNR source well locations](https://gisdata.in.gov/server/rest/services/Hosted/WaterWells_DNR_Water_IN_1/FeatureServer/0) provide source ID, measured-versus-estimated location context and header depths. Lithology intervals, if separately obtained from official wells.txt and litho.txt exports, join by well refno. Do not manufacture intervals.
- [USDA NRCS SSURGO](https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo) map-unit polygons do not constitute a geotechnical boring or guaranteed site-specific Ksat/USCS.
- [IDEM Institutional Controls](https://www.in.gov/idem/cleanups/investigation-and-cleanup-programs/institutional-controls/) require reviewing the underlying legal instrument; absence from an incomplete snapshot is not proof a site is uncontaminated.

Official DNR bulk well-text exports may have per-record fees. The public twin should provide free metadata links and downloads where permitted, without promising unrestricted zero-cost full lithology files.

## Acceptance gates

1. Actual downloaded official FEMA polygons, count and OBJECTID inventory verified with recorded SHA-256.
2. Old 35-panel registry reconciled to current FEMA panels, or source drift marked REVIEW.
3. Every parcel result explicitly distinguishes FEMA mapped SFHA overlap from incomplete source coverage.
4. LOMA eligibility, map misclassification, hazard exclusion and elevation certification remain **undetermined** unless separate defensible site and agency evidence is reviewed.
5. Actions live job and hosted artifact independently verified; no binary publication claims based only on code tests.
6. Native parcel UI integration, headed render and offline startup require their own release evidence; this tool does not close those gates.

## Whole footprint inventory and calibrated flood references

The [official acquisition run](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/43808473131)
produced an archive of 35 effective panels and 123 hazard-zone polygons.
The archive SHA-256 is
`07312ab7d5f7fa4d92cb317284726768d10682a206ae3ea2802b4106c8bcd0b5`.
Its county parcel output contains 4,412 positive SFHA overlaps with complete
source coverage, 15,880 without SFHA overlap, 147 with incomplete FEMA-zone
coverage, and nine unusable input parcel geometries. The incomplete results
require checking the source boundary or mapping coverage before drawing a
conclusion. These stricter coverage rules explain why this result should be
kept distinct from a simple positive-area intersection against SFHA polygons.

For the building screen, Indiana GIO layer 0 independently returned 23,082
distinct OBJECTIDs and a feature count of 23,082 with `county='Posey'`.
The building ID sets in that response and the
[October footprint archive](https://github.com/ATphobia22/Tri-State-Systems-Manager/releases/tag/igio-posey-20261006)
matched exactly. The 22,815-record legacy building snapshot lacks 267 archive
IDs. This confirms a footprint inventory gap in that snapshot. LiDAR roof
height, ground height, occupancy, and mesh release coverage each require
their own evidence.

The optional `screen --footprints FILE --footprint-sha256 SHA256` runs the
same coverage checks independently on all 23,082 archived building
polygons and keeps the source OBJECTID on each result. The local replay
preserved the published parcel rows exactly. The full footprint result
contained 2,024 SFHA overlaps with complete coverage, 21,029 without overlap,
17 with incomplete zone coverage, and 12 unusable building geometries.
Of the 267 IDs absent from the legacy 3D snapshot, 227 had an SFHA overlap
with complete coverage, 28 did not overlap, 10 had incomplete zone coverage,
and two had unusable geometry. The live workflow
downloads the pinned archive and writes parcel and building results into the
same receipt. A building can sit outside the mapped SFHA even when part of
its parcel crosses that boundary. Use the footprint result for structure
location screening and review the correct FEMA route for the subject.

### Regional building coverage

| Source | Applicable use | Coverage limit |
| --- | --- | --- |
| [Indiana GIO LiDAR-derived Building Footprints, layer 0](https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0) | Primary Indiana source for a vintage-bound footprint inventory | The product represents 2016–2020 LiDAR. An exact inventory match does not establish current construction or accepted 3D heights. |
| [FEMA and ORNL USA Structures](https://gis-fema.hub.arcgis.com/datasets/fedmaps::usa-structures/about) | Cross-state candidate geometry for the Indiana, Illinois and Kentucky county footprints | The FEMA catalog describes a 450-square-foot scope limit. Reconcile additions and omissions against source imagery, vintage, and local data. |
| [Illinois State Water Survey footprint service](https://services5.arcgis.com/obNUfH34Jumf2pH0/ArcGIS/rest/services/StateData_BuildingFootprints/FeatureServer) | Independent legacy Illinois comparison for White, Wabash and Gallatin counties | The publishing service attributes the underlying polygons to Microsoft. Establish applicable reuse terms and compare geometry before use. |
| [Kentucky KyFromAbove](https://kygeonet.ky.gov/catalogexplorer/) | Official imagery, DEM and point-cloud inputs for Henderson and Union counties | Verify year and AOI coverage per tile. Its terrain and imagery catalog does not supply a verified building inventory. |
| [USACE National Structure Inventory](https://www.hec.usace.army.mil/confluence/nsi/) | Exposure and omission QA against independently sourced polygons | Use the structure records as modeled exposure data. Treat height and ground attributes according to their source lineage. |

### Model evidence and research applied

[USGS SIR 2016-5119](https://doi.org/10.3133/sir20165119) provides a
calibrated 3.68-mile Wabash River reach around New Harmony and 17 profiles
for 10.0–25.4 ft of local gage stage. USGS used the station rating and April
2013 high-water marks for calibration. The official
[output directory](https://pubs.usgs.gov/sir/2016/5119/downloads/) lists
inundation polygons, depth grids and metadata. The directory supplies a
reach-limited validation benchmark. The model project and direct archive
bytes were not obtained in this run. For a different reach, obtain the
controlling model and effective profile through the
[Indiana DNR model library](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/state-engineering-resources)
and FEMA. Check confluence boundary conditions, channel bathymetry, levees,
structure representation, survey controls, and independently observed flood
extents or water levels before applying a model to site evidence.

The [Undermind Mapping folder](https://app.undermind.ai/projects/a7e00569-659c-4637-beb9-629feba0d48f?path=%2FMapping%2F)
contains 250 cataloged papers. Relevant findings reviewed from their
abstracts include [Biljecki et al. on height references](https://doi.org/10.4233/UUID:09D030B5-67D3-467B-BABB-5E5EC10F1B38),
[Mustafa and Szydłowski on building resistance and obstacles in HEC-RAS 2D](https://doi.org/10.7717/peerj.11667),
[Bhola et al. on constraining roughness with observations](https://doi.org/10.5194/nhess-19-1445-2019),
and [Bösmeier et al. on checking flood-mark reliability](https://doi.org/10.5194/nhess-22-2963-2022).
Record ground and roof references separately. Treat building blockage and
roughness as model choices and test how they affect results. Use dated,
datum-controlled observations to constrain roughness and verify on events
with disjoint time windows, following [USACE calibration guidance](https://www.hec.usace.army.mil/software/hec-ras/documentation/HEC-RAS%205.0%20Users%20Manual.pdf).
The existing stage-validation command now tests independence across full
sample windows and applies its acceptance policy in one stated unit using
unrounded statistics. Passing that gate supports independent review of the
paired stage series. It does not establish parcel-level fidelity.
