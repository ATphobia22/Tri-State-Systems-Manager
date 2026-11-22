# Tri-State official-source terrain, tile, building and temporal acceptance (2026-11-22)

**Scope:** Eight-county operational footprint: Indiana Posey (18129), Vanderburgh (18163), Gibson (18051), Warrick (18173); Illinois White (17193), Gallatin (17059); Kentucky Henderson (21101), Union (21225). Illinois Wabash (17185) exists in historical material but is not silently added to this approved eight-county contract. This is an **evidence and engineering implementation protocol**, not a declaration that the three-state tiles are complete.

## Verified upstream sources and purpose

| Authority | Actual official entrypoint | Content / required checks |
|---|---|---|
| USGS 3DEP | https://www.usgs.gov/3d-elevation-program/about-3dep-products-services | Source lidar, bare-earth DEMs, emerging 1 m seamless DEM; preserve original acquisition time, QL, units, checkpoints, source metadata, checksums and voids. |
| USGS seamless DEM specifications | https://pubs.usgs.gov/publication/tm11B9 | Tiling, georeferencing, edge treatment, vertical accuracy and provenance QA requirements. |
| NOAA NGS GEOID18 | https://www.ngs.noaa.gov/GEOID/GEOID18/ | Hybrid NAD83(2011) / NAVD88 model, not a universal WGS84 height transform. Verify epoch, signed N and official grid identity. |
| Indiana GIO IGIO LiDAR | https://www.in.gov/gis/ | Indiana source imagery/elevation/COPC discovery; source layer CRS and vertical units must be read from actual files, not assumed from a portal. |
| Indiana GIO Building Footprints | https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0 | Source OBJECTID and geometry; Posey count-only and ID-only live query gave 23,082 on 2026-11-22. Reconcile actual IDs, geometries and vintage independently. |
| Illinois ISGS ILHMP LiDAR | https://clearinghouse.isgs.illinois.edu/data/elevation/lidar/ | 2020 White and Gallatin LAS/DTM; inspect each tile's metadata and EPSG, horizontal/vertical units, nodata and overlap. |
| Kentucky KyFromAbove | https://kygeonet.ky.gov/catalogexplorer/ | STAC geographic/time selection and phase-specific lidar/DEM/imagery; verify asset roles and intersect with exact county polygons. |
| Kentucky lidar specifications | https://kygeonet.ky.gov/kyfromabove/pdfs/Specs_LiDAR_Production.pdf | 2026-08-12 revision: NAD83(2011), Kentucky Single Zone, U.S. survey feet, NAVD88 and geoid-model metadata. Verify each data delivery independently. |
| USACE HEC-RAS | https://www.hec.usace.army.mil/confluence/rasdocs/hgt/latest/tutorials/terrain/creating-a-ras-terrain | RAS terrain projection, vertical conversion, 2D mesh and breaklines. Hydraulic validation remains model-specific. |
| FEMA NFHL | https://msc.fema.gov/ | Effective FIRM panels, floodway/BFE and incorporated LOMCs. Never replace the regulatory map with an advisory or screening raster. |
| OGC 3D Tiles | https://www.ogc.org/standards/3DTiles/ | GLB, source-linked feature identity, implicit hierarchy, geometric error and subtree availability. Verify published tiles with a conforming validator and a headed renderer. |

## Verified live service metadata contracts (2026-11-22)

These are **provider-returned service definitions**, not proof that every requested Posey or tri-state tile has been downloaded. A configured URL alone does not establish a valid source raster or a regulatory designation.

| Source | Confirmed direct endpoint and relevant layer IDs | Evidence and ingestion rule |
|---|---|---|
| USGS 3DEP dynamic bare-earth service | https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer | Published service metadata reports an October 26, 2026 data cut-off and WMS/WCS support. It is a dynamic multi-resolution mosaic, not a replacement for source-DEM metadata or verified submerged bathymetry. |
| USGS seamless 1 m S1M | https://data.usgs.gov/datacatalog/data/USGS%3A4f34caac-f28f-4ea0-8d82-eafb2b8f9a5d | **This product is EPSG:6350** (NAD83(2011) CONUS Albers), with NAVD88 (EPSG:5703) and GEOID18 vertical lineage. Do **not** mislabel S1M as EPSG:26916. Some original project-based 1 m DEMs use UTM; always inspect each asset independently. |
| Indiana GIO DEM footprint tile index | https://gisdata.in.gov/server/rest/services/Hosted/Indiana_DEM_Tile_Footprints/FeatureServer/0 | ID 0; name 'Indiana DEM Tile Footprints 2016-2020'. Spatial source is EPSG:3857, no Z. Use `urlpath`, `filename`, `image_year`, `pixel_size` only as **index metadata**; fetch real DEM headers, hashes and vertical datums separately. |
| FEMA effective NFHL service | https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer | Verified service root: Cross-Sections (14), Base Flood Elevations (16), Flood Hazard Zones (28), LOMAs (34), FIRM Panels (3). Resolve fields, effective dates, LOMC incorporation and service revisions at acquisition; never infer jurisdictional acceptance from generic symbology. The alternate `/gis/nfhl/rest/` URL from the supplied directory was not independently verified. |
| USACE NLD official public feature service | https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer | Alignment Lines (7), Embankments (11), Floodwalls (12), Leveed Areas (16). Service lists NAD83 EPSG:4269 and a vertical reference identifier; validate per-layer Z/units and surveyed crest attributes before using for design. |

A projected CRS reference such as EPSG:2966 (NAD83 / Indiana West ftUS) and EPSG:2968 (NAD83(HARN) / Indiana West ftUS) identifies **different horizontal realizations**. Treat a file labeled EPSG:2968 as HARN, not interchangeable with EPSG:2966 merely because both are Indiana West feet. Exact source WKT, transformation grids, coordinate epoch and metadata must govern the operation. A 2D EPSG identifier does not certify the source vertical datum.

## Datum chain and coordinate contract

1. Preserve the **native** horizontal CRS and realization for every physical input. Known relevant examples include Indiana West EPSG:2966, Illinois East NAD83(2011) service EPSG:6455 and Kentucky Single Zone EPSG:3089. These are examples, **not assumptions** for every object/file; source metadata can differ.
2. Native source vertical datum and units are mandatory. Use the exact U.S. survey-foot conversion `1 ftUS = 1200/3937 m`, not an unlabelled 0.3048 constant. Reject unknown source Z units from engineering processing.
3. When required, `h_NAD83(2011) = H_NAVD88 + N_GEOID18`, where N is a **signed** geoid separation interpolated from the official, hashed grid for each position. Do not apply a single countywide N or confuse a datum conversion with the NAD83-to-WGS84 frame/epoch transformation.
4. Perform the independently specified horizontal frame/epoch transformation before claim of survey-grade ECEF coordinates; use a common surveyed reference and propagate source uncertainty. Display-only ENU offsets must carry a visible `UNVERIFIED` status.
5. Persist provenance: agency/service/layer, source URL + timestamp, source item/revision, acquisition date (if provided), raw SHA-256, source CRS WKT/EPSG/epoch, vertical datum/geoid/grid hash/units, transformation pipeline/version and control residuals.

## Real terrain seams — numerical release receipt

For the exact state-border intersection and every adjacent source tile, **do not invent missing elevations or blend away unmeasured discontinuities**. Independently resample overlapping source data to a declared common geodetic grid and distinguish: (a) numeric DEM overlap residual, (b) boundary vertex coincidence, (c) render-only Transvoxel transition cracks.

For matched sampled elevations `z_Ai,z_Bi` in **the same vertical datum/metre units**, compute:

- `d_i = z_Ai - z_Bi`
- `bias = sum(d_i) / n`
- `MAE = sum(abs(d_i)) / n`
- `RMSE = sqrt(sum(d_i*d_i)/n)`
- `maximum_absolute = max(abs(d_i))`

Record sample point coordinates, provenance, nodata counts, histogram/quantiles, uncertainties and distribution by terrain class. A tolerance must be traceable to the **actual** source vertical accuracy, control observations and use case; do not invent a universal metre threshold. For independent zero-mean random errors only, the approximate combined standard uncertainty is `sqrt(u_A^2 + u_B^2)`; correlated errors require a covariance term. Avoid equating nominal raster resolution with measured accuracy. Compare actual input edges and LOD transition faces before visual masking or skirt rendering.

Keep `NO_OVERLAP`, `SOURCE_UNAVAILABLE`, `DATUM_UNVERIFIED`, and `SEAM_FAILED` distinct. No-overlap or unavailable sources cannot be reported as passing a measured seam test.

Existing implementation entrypoints to exercise, without claiming full-county proof: `scripts/geospatial/mount_vernon_dem_transvoxel_gate.py`, `scripts/geospatial/benchmark-real-dem-transvoxel.py`, `scripts/geospatial/transvoxel_county_run.py`, `scripts/engineering/independent_acceptance_gate.py`.

## 3D Tiles, buildings, material surfaces

- Require one-to-one IGIO source IDs between source inventory, height evidence, GLBs, implicit feature metadata and 3D Tiles release manifests. The last inspected 2026-11-21 countywide job had **20,515 / 23,082** accepted height-linked footprints, including **11,826 OBSERVED** and **8,689 DERIVED**; **2,567** were unavailable. These are job observations, not a permanent baseline.
- Distinguish **OBSERVED** roof/ground returns from **DERIVED** estimates and `UNAVAILABLE`; never mark fabricated extrusion values as measured. Track conflicting `igioObjectId` / `OBJECTID` aliases, source geometry versions and all rejected LiDAR quality flags.
- Do not interpret LAS Class 8 as roof points; validate classification semantics for each data set before deriving heights. Tree-confounded roof returns require review, not an arbitrary roof-plane fit.
- 3D Tiles 1.1 implicit subtree **JSON** may reference external `.bin` bitstreams. JSON files advertised as binary `.subtree` containers are non-portable: URIs, extensions, MIME types and actual payload format must agree. Confirm content/child availability bit arrays and source-linked feature tables in a conformant validator.
- Terrain/building/road interface must use a consistent frame, consistent normal direction, actual ground contact and bounded physical residuals. Procedural road/foundation texture blending and RVT/PCG are **rendering**, not new geodetic measurements. Materials may be cinematic but never imply verified source observations.

## 3D / 4D / optional 5D meaning

- **3D:** X/Y/Z source geometry with source CRS/datum, uncertainty and feature identity.
- **4D:** 3D state indexed by UTC event and valid-time, with ingestion timestamp, immutable source observation digest, replay and a clear `LIVE_OBSERVATION` / `STALE` / `SOURCE_UNAVAILABLE` distinction. Do not overwrite historical snapshots with undated current state.
- **5D:** **A separately versioned application dimension**, e.g. scenario, cost, material lifecycle or provenance classification, only where an explicit schema defines it. 5D is not an extra surveyed spatial coordinate, nor evidence of an observed future condition. Any predicted hydraulic or construction outcome must be identified as a model/scenario with its uncertainty and version.

## Release status and gate dependencies (not green by documentation)

1. Exact eight-county source acquisition, data licensing and native metadata readback.
2. Cross-border DEM + orthometric/ECEF transformation with measured, reproducible seam and control reports; no unverified datum or nodata filling.
3. Full source-ID, roof/ground height and mesh linkage for all 23,082 Posey footprints. A **partial visual preview** may be published with incomplete count clearly disclosed, but does **not** close the full-coverage engineering gate.
4. OGC 3D Tiles validator, evidence receipt/checksums, real Cesium headed loading and real Atlas terrain, imagery, parcels, building toggle, camera navigation, collapse controls and gauge fallbacks.
5. Independent HEC-RAS source/model version and holdout validation; no automatic NFIP certification.
6. Independent UE5.8 Win64 Shipping compile/cook/package, signature, SHA-256 artifact, clean **network-disabled** Windows 11 launch, local data reads and headed FPS/VRAM/hardware evidence. PR unit tests, a skipped package job or a Pages build do **not** close this gate.

**Human Authority Final.** Public viewing remains anonymous and free. Nonvisual ingestion, validation and packaging are headless. Scientific outputs are analytical support and are not formal regulatory determinations.
