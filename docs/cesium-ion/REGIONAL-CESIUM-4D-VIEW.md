# Tri-State regional Cesium 4D view

[Open the public Cesium experience](https://atphobia22.github.io/Tri-State-Systems-Manager/cesium/). CesiumJS, its workers, the project geometry and the river archive are served by the Pages build. The aerial basemap streams from the USGS National Map. The view requires WebGL 2. The local data layers do not require a Cesium ion token.

| Layer | Source and coverage |
| --- | --- |
| Terrain | Four versioned USGS 3DEP seamless 1-arc-second rasters with their source digests, metadata and dates in `data/cesium-regional/terrain/sources.json`. The byte-pinned NOAA NGS GEOID18 grid provides the display conversion from source NAVD88 metres to approximate ellipsoidal heights. Regional detail tapers to the reference ellipsoid beyond the source visualization boundary. |
| Aerial imagery | [USGS The National Map Imagery Only](https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer), credited to USGS and USDA. |
| Roads | 29,461 road centerlines across Gallatin, Wabash and White in Illinois; Gibson, Posey, Vanderburgh and Warrick in Indiana; and Henderson and Union in Kentucky. Includes labels and Census source IDs from the nine pinned county input archives. [2024 TIGER/Line road source](https://www.census.gov/cgi-bin/geo/shapefiles/index.php?layergroup=Roads&year=2024). |
| 3D buildings | 20,517 unique LoD1 building IDs in the existing Posey screening tileset. The independently audited mesh release and the 23,082-footprint inventory have different acceptance records. [Published subset format audit](../evidence/IMPLICIT-GLTF-FORMAT-REPAIR-2026-11-07.md). |
| Mount Vernon detail | Indiana GIO open GIS includes city-area planimetric footprints and streets. The viewer checks the scene SHA-256 and attributes the [Polis Center footprint source](https://www.arcgis.com/home/item.html?id=384f2d5041a14c34bd9e807c568784da) and the [Indiana GIS Data Harvest road source](https://www.arcgis.com/home/item.html?id=5d57e7f449d0435891666dc11a7162b1). The discovery extent includes land outside the incorporated city. |
| River replay | Approved April 2025 daily means for Wabash discharge at New Harmony (03378500), Ohio River gage height at Evansville (03322000), and gage height at Uniontown Dam (03322420). Each series retains its public [USGS source](https://api.waterdata.usgs.gov/ogcapi/v1/collections/daily), source digest, time, units, qualifier and approval. Station gage heights retain their local references. |
| City flood screening | Eight hypothetical fixed levels from 100 to 135 m NAVD88. A four-neighbor path from the Census Ohio River surface into the USGS terrain determines which cells are connected at each level. The grid covers the [2020 Census incorporated place GEOID 1851732](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/18). The output records the connection count inside that city boundary and the surrounding extent. |

The screening assumes a single steady level and uses a regional bare-earth DEM. It omits river hydraulics, travel time, velocity, levee and structure performance, drainage, culverts and bridge deck elevations. It is suitable for comparing hypothetical extents in the viewer. Hydraulic forecasts, regulatory maps and engineering designs require separately accepted evidence.

## Rebuild and verify

The [Pages workflow](../../.github/workflows/deploy-pages.yml) assembles the data with pinned dependencies on a headless runner. Prepare the same dependencies locally, then:

```bash
python scripts/geospatial/build_cesium_regional_scene.py --cache /tmp/tsm-cesium-dem --output tsm-console/public/data/cesium-regional
python scripts/geospatial/build_mount_vernon_scene.py --output tsm-console/public/mount-vernon-scene
npm --prefix tsm-console ci
npm --prefix tsm-console run build
python scripts/geospatial/verify_cesium_regional_scene.py tsm-console/dist
```

The production workflow checks the terrain tile inventory, child masks and tile seams, building tile and city archive checksums, nine-county roads, three historical series and monotonic screening coverage. Headed Chrome also checks the rendered route under the actual Pages base path.

The separate [Building 3D Tiles run](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/43587135679) reached 20,518 height-linked features of 23,082. It rejected 2,564 with missing or ambiguous ground or roof returns. The validated published subset above remains independent. The custom Cesium ion imports and native Unreal Shipping verification are tracked by their own release gates.
