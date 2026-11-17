# TSM Cesium 4D review — concepts, optional ion layers and county evidence (2026-11-17)

## Three approved future-state concept images

The README now uses three **generated design illustrations**, not screenshots:
- [Regional open world](../../docs/assets/concepts/tsm-regional-open-world-4d-concept.jpg)
- [Mount Vernon building detail](../../docs/assets/concepts/tsm-mount-vernon-3d-concept.jpg)
- [Flood engineering workbench](../../docs/assets/concepts/tsm-flood-workbench-concept.jpg)

Source visuals: user-provided screenshots of the live Cesium page and rural flood/aerial references; illustrations are not registered orthophotography, certified survey, or simulation output.

## Existing renderer and incremental upgrade

The `/cesium/` view continues to use locally hosted source-derived USGS terrain/imagery, Posey LoD1 3D Tiles, and TIGER road outlines as its default path. New accordion controls are map-first and mobile friendly. The entire controls column starts collapsed; camera, layers, replay, flood screening and lighting each expand independently.

The following opt-in, **online** Cesium ion assets are selectable **only when** a public, URL-restricted `VITE_CESIUM_ION_TOKEN` is configured at build time:

| Asset ID | Intended role | Implementation boundary |
|---|---|---|
| 1 | World Terrain | Optional replacement for local terrain; no blending of competing heights |
| 96188 | Cesium OSM Buildings | Contextual building 3D Tiles; *mutually exclusive* with locally derived Posey meshes |
| 3830183 | Google 2D satellite imagery with labels | Optional alternative opaque basemap |
| 3891168 | Azure aerial | Optional alternative opaque basemap; authorization and licensing remain account-specific |
| 3891169 | Azure road imagery | Optional alternative opaque basemap; authorization and licensing remain account-specific |
| 3954 | Sentinel-2 | Optional alternative imagery basemap |
| 2275207 | Google Photorealistic 3D Tiles | Existing opt-in `/photorealistic-3d/` route; **not** stacked with the local source-derived terrain and Posey building meshes |

Cesium layer creation uses `IonImageryProvider.fromAssetId`, `CesiumTerrainProvider.fromIonAssetId` and `Cesium3DTileset.fromIonAssetId` where applicable. Rendering one opaque basemap at a time avoids occluding duplicated imagery. Assets can still fail due to permission, quota, source outages or runtime constraints: permission to render an asset is **not** permission to redistribute or package it offline.

**Seamlessness is not established merely by selecting an imagery service.** Terrain datum/vertical alignment, tile-edge repair, source vintage, imagery color balance, and county joins require separate spatial checks and runtime inspection.

## County-scope review

The authoritative `data/regional/eight-county-exact-spatial-validation-v1.json` defines exactly:

| State | County | GEOID |
|---|---|---|
| IN | Posey | 18129 |
| IN | Vanderburgh | 18163 |
| IN | Gibson | 18051 |
| IN | Warrick | 18173 |
| IL | White | 17193 |
| IL | Gallatin | 17059 |
| KY | Henderson | 21101 |
| KY | Union | 21225 |

The `scripts/geospatial/build_cesium_regional_scene.py` road-building routine also includes **Wabash County, Illinois (17185)** in a wider, nine-county TIGER roads file. This does not expand the exact eight-county engineering validation contract, and should not be mistaken for uniform all-layer coverage.

New optional *navigation-only* camera anchors for White County (Carmi, IL; approximate 38.086°N, 88.172°W) and Union County (Morganfield, KY; approximate 37.684°N, 87.917°W) improve manual inspection of both sides of the river. Coordinate approximations are community reference locations, not a statement that the surrounding building meshes have been acquired or validated.

The current local Cesium runtime advertises **20,517 LoD1 Posey meshes plus 2,565 footprint-only IDs** as a preview. A separate Posey inventory targets **23,082** authoritative identities. **No deployed region-wide LoD2/LoD3/LoD4 fully material-textured building mesh for all eight counties is confirmed by these code changes.** The new 'Sharper tiles' control reduces the Cesium screen-space-error threshold but cannot synthesize missing geometry, PBR textures, or photogrammetry.

Regional county names, routes and road inventories should be differentiated from verified parcel, DEM, roof, imagery and flood feature inventories. The released eight-county contract requires exact polygon intersects/within checks and metadata/hash evidence for each layer.

## Testing / required release proof

- Run TypeScript build/Parse Gate and Cypress Cesium route tests, including mobile and controls collapse.
- Verify switching local and ion presets with both valid public-scoped and missing token, including fallback when the remote service rejects access.
- Test local and OSM building exclusivity and tile refinement changes; compare network requests and GPU memory.
- Validate terrain and imagery seam geometry with source vintages, horizontal CRS, vertical datum, and tile-edge checks.
- Verify all eight counties' actual feature coverage against exact county polygons, not just the registry and camera points.
- Investigate observed transient Pages error `Unable to preload CSS for .../assets/CesiumRegionalTwinView-B9PM1oNb.css`; confirm published hashed asset exists, routing and cache/service-worker state before claiming a fix.
- Native UE5.8 Windows Shipping, offline source licensing, source material detail and independent regulatory use remain separate release gates.

## Primary sources

- [CesiumJS imagery tutorial](https://cesium.com/learn/cesiumjs-learn/cesiumjs-imagery/)
- [IonImageryProvider](https://cesium.com/learn/cesiumjs/ref-doc/IonImageryProvider.html)
- [Cesium3DTileset](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html)
- [National Map / 3DEP](https://www.usgs.gov/the-national-map-data-delivery)
- [Census TIGER/Line](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html)

## Production Pages build reliability (observed on PR #634)

A source-ingest step in the production workflow failed on 2026-11-17 due to a `TimeoutError: The read operation timed out` from `gisdata.in.gov` during the Mount Vernon footprints download (job `133941329627`, step `Stage Indiana GIO Mount Vernon footprints and street centerlines`). The failure occurred **before** the production UI build. This is not evidence of invalid city shapes or of a TypeScript failure. A follow-on commit added up to three bounded retries for transient timeouts, HTTP 408/429, and selected 5xx responses. 403, malformed JSON, overlarge responses, incomplete source ID batches and missing geometry still fail. CI must rerun and prove the staging and final Pages build before treating this as fixed.

An additional official City Scene Snapshot job, **133943761664**, showed the upstream ArcGIS service returning an application-level JSON error `{"code":503,"message":"User couldn't access this resource 'hosted/building_footprints.mapserver'."}` on 2026-11-17. The service metadata is publicly indexed, but that does **not** prove query access. This follow-up also retries bounded ArcGIS JSON 503 responses; persistent 503 remains a blocker and must not be mislabeled as successful source ingestion. No substitute data or bypassed authentication is used.

## Cesium OSM Buildings attribute styling (Sandcastle-derived implementation)

The browser-side OSM layer now supports five mutually exclusive scene render modes: original appearance, color by `building:material`, color by `building` use, color by `roof:shape`, and color by height **provenance** (`height` directly tagged vs Cesium `cesium#estimatedHeight`). This uses the same `Cesium3DTileStyle` conditional feature expressions and explicit neutral fallback pattern as the [Cesium Sandcastle source](https://github.com/CesiumGS/cesium/blob/main/packages/sandcastle/gallery/3d-tiles-feature-styling/main.js). The **roof-shape style colors the whole available building mesh**, not new roof geometry. It is a categorization tool, not a measured architecture model.

Picking distinguishes the **actual Cesium OSM tileset** from local Posey-derived 3D Tiles via `Cesium3DTileFeature.tileset`, and displays bounded known tag fields only: `elementType` + `elementId` (joint identifier), `name`, `building`, `building:material`, `roof:shape`, `roof:material`, `building:levels`, `height`, `cesium#estimatedHeight`, and `source`. Direct `height` remains an unverified OSM tag with its original units, and `cesium#estimatedHeight` is explicitly labeled **estimated, not measured**. Undefined properties render neutrally; no fake façade material, roof height, field survey, or NFIP conclusion is inferred. Original OSM display styling can be restored without reloading geometry.

The world-scale [taginfo key database](https://taginfo.openstreetmap.org/keys) (API stats as of 2026-11-16) reported approximately 44.1M `building:levels`, 9.9M `roof:shape`, 2.59M `building:material`, and 2.50M `roof:material` occurrences **globally**. These numbers **are not counts for the eight Tri-State counties** and must not be used as local data completeness estimates. Preserve the [Cesium OSM Buildings terms and attribution](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/); © OpenStreetMap contributors.

### Future physically more detailed LoD — separate headless production

1. **Acquire source-grade roof and façade data:** lidar roof planes and elevations tied to declared CRS/vertical datum, BIM/photogrammetry where legally licensed, and field review when required. Do not infer physical materials from an arbitrary OSM tag on a different building footprint.
2. **Resolve identity and data lineage:** exact county boundaries; cross-border seam checks; IGIO and IL/KY footprint IDs; optional OSM element-type + element-id matching with geometry overlap and recorded confidence. Count unmatched/duplicate buildings; do not replace source geometry based on tag count.
3. **Build progressively:** LoD1 volume from verified footprint/height; LoD2 roof planes via geometric estimation with residual metrics; LoD3 façade openings only where source evidence supports them; LoD4 interiors only from authorized interior data.
4. **Publish explicit 3D Tiles metadata:** per-feature IDs via `EXT_mesh_features` and `EXT_structural_metadata`, source quality/evidence hashes, material confidence, roof residuals, geometry LoD. Validate 3D Tiles and glTF, then benchmark texture KTX2 compression and geometric error in headed browsers.
5. **Visualize confidence separately from visual polish:** a styling rule can expose missing tags; never claim a valid building texture, structural assessment, or surveyed roof from changing `maximumScreenSpaceError`.

Additional upstream examples: [3D Tiles inspector](https://sandcastle.cesium.com/), [metadata styling](https://sandcastle.cesium.com/gallery/aec-metadata-styling/), [KTX2 texture compression comparison](https://sandcastle.cesium.com/), and [Cesium3DTileFeature](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileFeature.html).

**Original OSM appearance preservation:** The implementation uses Cesium's documented `createOsmBuildingsAsync()` instead of raw `Cesium3DTileset.fromIonAssetId(96188)`; the factory applies its published tag-informed default colors and outlines. The original `tileset.style` is retained when switching to a category color mode, then restored when the user selects Original appearance. This is a renderer presentation improvement; it neither adds genuine PBR building assets nor proves locally mapped materials. [CesiumJS reference](https://cesium.com/learn/cesiumjs/ref-doc/global.html#createOsmBuildingsAsync).
