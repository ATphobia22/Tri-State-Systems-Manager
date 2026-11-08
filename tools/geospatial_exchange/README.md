# Offline geospatial exchange workbench

This preprocessing layer connects locally exported assets to provenance inventories,
imports real Parquet tables into an offline DuckDB database without changing source
columns, and runs explicitly supplied local authoring tools with exit-code/log receipts.
It is not a replacement for a licensed capture product or an Unreal runtime plugin.

```powershell
python -m pip install -r tools/geospatial_exchange/requirements.txt
python tools/geospatial_exchange/usgs_discover.py --collection daily --station 03378500 --datetime 2025-01-01T00:00:00Z/2026-01-01T00:00:00Z --output discovery
python tools/geospatial_exchange/usgs_download.py discovery/download-plan.json --output downloads
python tools/geospatial_exchange/workbench.py stac-plan discovery/page-0000.json --output page-plan.json
python tools/geospatial_exchange/workbench.py parquet local-data/daily.parquet --output water.duckdb
python tools/geospatial_exchange/workbench.py inventory local-data --output local-data-manifest.json
python tools/geospatial_exchange/workbench.py run --executable C:/Tools/Ographis/og.exe --receipt og-run.json -- run model.ographis
python tools/geospatial_exchange/workbench.py run --executable "C:/Program Files/Blender Foundation/Blender 4.3/blender.exe" --receipt blender-run.json -- --background --python tools/geospatial_exchange/blender_validate.py -- local-data/model.glb blender-import.json
python -m unittest discover -s tests/geospatial_exchange -v
```

USGS discovery retains pages and emits a complete plan only when pagination ends.
The explicit `usgs_download.py` step downloads approved USGS-hosted assets with a 100 MiB per-file cap, preserving URLs and hashes. Review the plan before downloading.
retain their source URLs and STAC pages, and use `parquet` on local files. STAC time filters select intersecting files, not rows inside Parquet; apply a separate time/parameter/statistic query to the imported tables. A daily
observation is not a continuous observation; station stage is not NAVD88 elevation.
No column names, unit conversions, quality acceptance or vertical conversions are
guessed. `source_manifest` binds each `source_N` table to the original file SHA-256.
The local database requires neither AWS nor a local HTTP server.

`inventory` hashes files but does not decode E57 or validate legal ownership, CRS,
quality or complete glTF external dependencies. Preserve original acquisition
metadata. Use the existing `tools/survey/field_exchange.py las` for LAS/LAZ decoding.
The generic runner executes operator-supplied programs, not programs named by
untrusted dataset metadata; inspect models/scripts before execution. It records
execution success separately from engineering acceptance. Blender validation is
an import check only, not cinematic or visual acceptance. Background Blender here
is authoring QA, not TSM's headed Unreal runtime.

## Integration state and research, 2026-11-08

| Candidate | Implemented connection / remaining work |
| --- | --- |
| USGS STAC / Parquet | Bounded, host-restricted discovery; saved-page planning; local DuckDB import with source hashes. Explicit bounded USGS-hosted downloads implemented; observation interpretation remains separate. |
| Cesium for Unreal 2.31.0 | Upgrade candidate only; production pin 2.29.1 unchanged pending Windows UE5.8 build and offline rendering evidence. |
| Iconem Blender 3D Tiles | Shared glTF import-validation path implemented; addon streaming, 3DGS, clipping and convergence not validated. Local Blender 4.3 cannot establish claimed Blender 5.3 splat support. |
| GeoLibre | Local GeoParquet/GeoJSON/GeoTIFF/GLB exchange inventory; no Tauri/browser embedding into native TSM. |
| PostGIS 3.7 | Database upgrade/topology evaluation pending; DuckDB snapshot path does not implement PostGIS topology. |
| Ographis | Explicit local CLI invocation with logs and binary hash; Rust/GDAL build and real model execution pending. |
| UgCS | Local survey-output exchange; flight planning, hardware control and commercial installation not implemented. |
| Octave Alto | Local media inventory only; licensed SDK and synchronized video rendering not implemented. |
| USDA/NASA | Data-source research only; MOU does not itself supply a new data collection. |
| ERDC shared URL | Contents unverified; no package installed from an unidentified link. |
| Realsee Galois P4 | E57/PLY/mesh/photo exports can be inventoried; actual camera/export sample absent. No claim of direct E57 geometry ingestion. |
| GeoD Global | Standalone downloader/file exchange candidate. GPL-3.0-only, WebView2 and default telemetry require consideration; not embedded in native runtime. |
| Gee-Luma | MIT project located; cartographic design reference. Earth Engine authentication and actual print-layout integration pending. |
| NASA CASALS | Research watchlist. Airborne prototype and planned 2027 campaign are not evidence of available regional coverage. |
| MapStore | FlatGeobuf/GeoJSON exchange inventory; web UI, FeatureService paging, Panoramax and GeoServer services not deployed. |

## Primary sources and upstreams

- https://api.waterdata.usgs.gov/docs/stac/
- https://cesium.com/blog/2026/11/03/cesium-releases-in-november-2026/
- https://github.com/Iconem/blender_ogc3dtiles
- https://geolibre.app/
- https://postgis.net/2026/10/PostGIS-3.7.0/
- https://github.com/gishubio/Ographis
- https://www.sphengineering.com/flight-planning/ugcs
- https://www.octave.com/products/geospatial-intelligence/alto
- https://www.nasa.gov/news-release/nasa-usda-sign-agreement-advancing-earth-science-agriculture/
- https://www.realsee.ai/pages/galois-p4 (E57/PLY exports; credits vary by deliverable)
- https://github.com/gaopengbin/geod-global
- https://github.com/suvasthigha-puvan/Gee-Luma
- https://science.nasa.gov/science-research/science-enabling-technology/technology-highlights/nasas-casals-instrument-bridges-gaps-in-3d-maps-of-earths-surface/
- https://www.geosolutionsgroup.com/blog/mapstore-2026-02-00-release/

MapStore's useful features include spatially incremental ArcGIS FeatureService
loading, read-only FlatGeobuf, feature-count limits, Panoramax and dynamic CRS
catalogs. These are candidates for future native equivalents or separate authoring
applications, not reasons to introduce runtime web dependencies. CASALS does not
replace Indiana lidar acquisition. Realsee export availability does not establish
survey accuracy or regional georeferencing. Dependencies retain their own licenses.

## Verification in this session

Four unit tests passed. Python bytecode compilation passed. Blender 4.3.2 imported a synthetic one-triangle GLB (3 vertices, 1 polygon). Live daily STAC discovery for USGS-03378500 completed, its Parquet asset downloaded, and 65,863 rows imported into DuckDB with all source columns retained. This is the station file, not a date-filtered observation result. No Windows UE build, vendor application compilation, 3D Tiles streaming or cinematic render was verified.
