# Mount Vernon building geometry, geodetic datum and HEC-RAS implementation audit
**Date:** 2026-11-09 · **Status:** implementation guidance; no engineering certification.

## Inputs and authority boundaries

- Indiana GIO candidate footprints: 23,082 unique OBJECTIDs, exact derived geometry matches, 12 self-intersection exceptions. The source geometry must not be altered silently. Input SHA-256: `172c2568864b6c012dc1fdebab245e25d64d23582d548a3c5a7b8eb09d8dec68`.
- Drive `buildings-3d.geojson`: 23,082 objects, SHA-256 `617a6116aaccac87354f0fa02285e322ec07c4e99ca9f0a14739f2c44f5cf881`. `DEFAULT_RURAL_MEDIAN`=12,155 and `OVERTURE_NEAREST_20M`=10,927. **These are estimates**, not observed roof surfaces, LoD2, or surveyed heights.
- 2020 Indiana LiDAR / 2.5 ft bare-earth DEM: primary candidate terrain reference after source-specific NAVD88/geoid/vertical-unit verification. Acquired TIFFs have horizontal EPSG:2968 (NAD83 HARN / Indiana West ftUS), not EPSG:2966. Raster pixels alone have no proven vertical datum.
- 2025 imagery and DSM: photographic texture and canopy/roof investigative surface. Never replace a bare-earth DEM with a DSM in hydraulics. Surface observations from different years must not silently be treated as coincident.
- Source identity, vertical provenance, and human/agency authority are separate controls.

## Concrete implementation (this PR)

`scripts/geospatial/prepare_posey_screening_extrusions.py` reads an **external** candidate (not in Git), enforces its exact SHA-256 and expected count, rejects duplicate IDs and missing/invalid heights, **omits** invalid polygons rather than repairing source topology, strips addresses/private source attributes and creates only `LoD1_ESTIMATED` GeoJSON screening prisms and a SHA-256 receipt.

It **never** derives building heights from counts, floor assumptions, terrain elevations, or third-party estimates when their provenance category is unknown. Display base is 0 m **AGL relative to the current map surface**, not a synthetic orthometric elevation. Publication of any output remains a separately reviewed decision.

Example with the independently reconciled Drive candidate:

```bash
python -m pip install shapely==2.0.6 pytest==8.3.5
python scripts/geospatial/prepare_posey_screening_extrusions.py \
  --input /secure/data/buildings-3d.geojson \
  --expected-sha256 617a6116aaccac87354f0fa02285e322ec07c4e99ca9f0a14739f2c44f5cf881 \
  --expected-count 23082 \
  --output /secure/derived/posey-screening-extrusions.geojson \
  --receipt /secure/derived/posey-screening-receipt.json
python -m pytest -q backend/tests/test_posey_screening_extrusions.py
```

The rendering adapter `tsm-console/src/lib/posey-screening-building-style.ts` uses only `tsm_visual_height_m` and strict `SCREENING_ONLY` / `LoD1_ESTIMATED` attributes, with muted coloring by estimate type and the layer initially invisible. The viewer no longer turns an unqualified live IGIO `height_m` into an apparent measured extrusion. The source is explicitly opt-in: the viewer reads `VITE_TSM_POSEY_SCREENING_GEOJSON_PATH` only for a relative local path under `data/screening/*.geojson` (no traversal, remote URL or query). For a *reviewed offline bundle*, stage the generated sanitized file at `tsm-console/public/data/screening/posey-screening-extrusions.geojson`, set `VITE_TSM_POSEY_SCREENING_GEOJSON_PATH=data/screening/posey-screening-extrusions.geojson` **at build time**, and ship its verified receipt in the private TSMData manifest. Leave this env unset in public distributions until publication approval and data minimization review. The building map toggle then controls both IGIO footprints and the distinct sanitized extrusion source, while object picking labels estimates `NOT SURVEYED`. The browser does not independently recompute this GeoJSON hash; do not mistake a successful visual render for pipeline provenance. This PR does **not** stage the raw Drive data.

## LoD2 / LoD3 next build path

1. **Geometry intake:** match IGIO `objectid` 1:1; preserve original geometry, source date, official feature service ID, raw SHA-256, 12 invalid-footprint decisions and human disposition. Use municipal boundaries for AOI screening.
2. **LiDAR intake:** index 2020 LAS 1.4/COPC with PDAL; inspect actual classification distribution. The sampled Mount Vernon tile lacks class 6 (building) points, so classify roof candidates with a documented algorithm and independent quality control rather than selecting nonexistent class 6 points.
3. **Observed heights:** inspect actual roof candidate points above footprint interiors; identify vegetation/bridges, robust roof planes and outliers. Sample separately validated bare-earth DEM for ground. Record source CRS/datum, acquisition year, units, point counts, vertical uncertainty, and per-building review.
4. **Roof reconstruction:** pilot `3DBAG/roofer` (point cloud + roofprint to LoD1.2/1.3/2.2 CityJSONSeq), or existing `3dfier` LoD1 pipeline. No GIS vector alone proves LoD2. Roofer's GPLv3 needs license review; run as a separate build tool rather than blindly copying library code into TSM.
5. **Geometry acceptance:** `cjval`/`cjio` CityJSON schema+geometric checks, independent 3D mesh topology validator, coordinate units, axes, ground contact, collision/mesh validity, per-building geometry/height/provenance acceptance. Reject 3D Tiles claims until output has been inspected on the actual runtime.
6. **3D Tiles/Windows:** use existing TSM CityJSON→3D Tiles and GLB pipelines, with validated object IDs and manifests. Review maintained `py3dtiles`, not abandoned `py3dtilers`. Stage verifiable local data with the offline UE5.8 package; test the packaged executable on clean Windows 11 without network.

## Datum-verification script: reject false equivalences

The Drive `verify-navd88-geoid18.py` is a **historical prototype**, not an independently authenticated geodetic validator. In particular:

- USGS station 03378500 is **Wabash River at New Harmony**, not a Mount Vernon Ohio River gauge. No upstream-stage site transfer is authorized without hydraulic evidence.
- USGS SIR 2016-5119 documents **352.67 ft** for the stage-to-NAVD88 relationship at that station (at its reported publication time).
- The currently displayed USGS location metadata lists **352.71 ft NAVD88** for altitude of gage/land surface. These differing quantities/times must be reconciled from the source before an operational gauge-zero offset is selected; do not assume 352.67 and 352.71 are interchangeable.
- Historical `353.20 ft` for that station is explicitly from older **NGVD29** gauge records (e.g. 2004 USGS water-data report), **not** NAVD88. The Drive prototype labels it NAVD88 and therefore cannot be trusted for conversion.
- NGS GEOID18 works for **NAD83(2011), epoch 2010.0** ellipsoid heights: `H_NAVD88 = h_NAD83(2011) - N_GEOID18`. It is not a vertical correction to apply indiscriminately to an existing orthometric DEM or to NAD83(HARN)/WGS84 heights.
- A true conversion must record NGS/PROJ operation ID, frame/epoch, grid file hashes, units, transformation accuracy and control checkpoint residuals. TSM should use its existing `StationDatumVerifier` and independent source acquisition, not import the hard-coded Drive values.

## HEC-RAS: staged release gates

**Technical checks already present in TSM (4):** approved AOI/watershed inputs; DEM byte hashes and source-specific vertical datum/units; transformation/source evidence; actual solver input/output hashes.

**Separate engineering/release evidence:** verify the actual executable/version, plan, geometry (`.g01`), unsteady-flow input (`.u01`, not automatically `.f01`), `.p01`, project `.prj`, terrain, unsteady log and `.p01.hdf`. Validate boundary hydrographs, bridge/levee geometry, 2D mesh/breaklines, solver stability, mass balance, calibration to independent observations, time-step/mesh sensitivity and sign-off appropriate to intended regulatory use. Only then publish qualified conclusions. A successful metadata hash alone **does not** prove that HEC-RAS ran.

Treat absence as an explicitly *unavailable* gate; contradictory evidence and datum/hash mismatch as *blocked*. Never upgrade "ready for engineering review" to "regulatory approved." The Drive `hec-gate-schema.json` is a descriptive object but **not a valid enforcement-grade JSON Schema**: its `properties` values are literals/arrays rather than schema definitions. Do not load it as an authority or runtime gate.

## Repository selection

| Repository | Decision | Reason |
|---|---|---|
| [3DBAG/roofer](https://github.com/3DBAG/roofer) | **Pilot external CLI** | Scientific LoD2.2 reconstruction from roofpoint cloud and footprint; GPLv3 |
| [tudelft3d/3dfier](https://github.com/tudelft3d/3dfier) | **Keep bridge** | LAS+polygons for LoD1 city fabric and DSM; GPLv3 |
| [maplibre/maplibre-gl-js](https://github.com/maplibre/maplibre-gl-js) | **Keep production viewer** | Feature-aware extrusion with metre-based height/base |
| [3dcitydb/3dcitydb](https://github.com/3dcitydb/3dcitydb) | Optional server-side GIS catalog | Not needed for offline native client |
| [LTplus-AG/ifc-lite](https://github.com/LTplus-AG/ifc-lite) | Optional IFC import/inspect | MPL-2.0; IFC source models required; not a LiDAR roof estimator |
| [Oslandia/py3dtilers](https://github.com/Oslandia/py3dtilers) | **Do not newly adopt** | Explicitly discontinued January 2025; favor maintained py3dtiles |
| OSMBuildings / MapTiler extrusion demos | Reference only | Duplicates MapLibre render; not survey geometry |
| reactiveui/splat, archived voxel/terraformer forks, CSG/Blender examples | Not on critical path | No supported evidence of LAS→validated roof geometry advantage |

## Sources

- [Indiana footprint candidate audit in TSM](../geospatial/POSEY-IGIO-CANDIDATE-AUDIT.md)
- [MapLibre fill-extrusion specification](https://maplibre.org/maplibre-style-spec/layers/#fill-extrusion)
- [3DBAG Roofer docs](https://innovation.3dbag.nl/roofer/)
- [3dfier repository](https://github.com/tudelft3d/3dfier)
- [CityJSON schema / validation](https://www.cityjson.org/tutorials/validation/)
- [USGS New Harmony station](https://waterdata.usgs.gov/monitoring-location/USGS-03378500/)
- [USGS SIR 2016-5119](https://pubs.usgs.gov/sir/2016/5119/sir20165119.pdf)
- [USGS historical NGVD29 datum](https://pubs.usgs.gov/wdr/2004/wdr-il-04/data/sw_q2004/03378500.htm)
- [NGS GEOID18 technical details](https://www.ngs.noaa.gov/GEOID/GEOID18/geoid18_tech_details.shtml)
- [USACE HEC-RAS project-file definitions](https://www.hec.usace.army.mil/confluence/rasdocs/rasum/latest/working-with-projects)

**Not verified by this PR:** real LoD2 roof meshes, certified vertical datum, independently surveyed roof elevations, full 23,082-building 3D Tiles coverage, hydraulic calibration, genuine HEC-RAS model execution, or the native Windows UE5.8 Shipping release.
