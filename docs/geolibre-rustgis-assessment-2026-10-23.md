# GeoLibre vs RustGIS — inspection for TSM's LiDAR / 3D-twin workflow

**Date:** 2026-10-23
**Branch context:** written on `feat/integrate-open-suggestions-20261023`
**Purpose:** inspection only — no integration, no installation, no commits.
**Sources:** official project sites and docs (geolibre.app, rustgis.app), the RustGIS-authored GeoLibre comparison page, GeoLibre's supported-formats/plugin pages, third-party writeups. All claims below are sourced; gaps are marked UNVERIFIED.

> Note: both projects are new (first releases in 2026) and move fast. The RustGIS comparison page itself warns details age quickly. Re-verify before acting on any specific claim.

---

## 1. GeoLibre (MIT)

**What it is:** web-first, cloud-native GIS — full app in a browser tab (static site, no account, no install), plus Tauri desktop builds, native Android **and iOS apps**, PWA, Docker, Jupyter widget, Python/R packages. Maintainer: Qiusheng Wu (same maintainer as RustGIS; the two are sibling opengeos projects).

**Licensing / lock-in:** MIT, self-hostable static build with no analytics (geolibre.app). Client-side by design: data leaves the device only when you add a remote URL or share a project. **Zero-lock-in fit: excellent.**

### LiDAR point-cloud viewing/processing

- **LiDAR Layer:** LAS, LAZ, and COPC load by drag-and-drop or `?data=` URL; the layer menu **exports clouds to LAS, LAZ, or COPC**, and **Whitebox LiDAR tool outputs load as new point cloud layers** ([geolibre.app/data-formats/](https://geolibre.app/data-formats/)).
- **Whitebox toolbox:** 1,000+ tools (vector, raster, remote sensing, hydrology, terrain, **LiDAR**, conversion, network) run **in the browser on WebAssembly** with no Python sidecar; "the full set works on the web, desktop, and Android" ([geolibre.app](https://geolibre.app)). *(UNVERIFIED: whether the full Whitebox WASM set works inside the iOS app / iOS Safari — the site's claim names web/desktop/Android only.)*
- **USGS LiDAR plugin:** clips a USGS 3DEP point cloud to an AOI and downloads it as COPC — directly relevant to TSM's 3DEP LiDAR inputs.
- **Spaceborne LiDAR:** v3.4 added ICESat-2 and GEDI footprint/photon layers.
- **Rendering:** point clouds handled via deck.gl on the map surface.

### 3D terrain / buildings

- **3D Tiles layer:** streams OGC 3D Tiles (authenticated tilesets supported via request headers); ArcGIS I3S scene layers (Integrated Mesh, 3D Objects); glTF/GLB placement; Gaussian splats.
- **Cesium globe option** (split pane) — **requires a Cesium Ion token** (per the Spatialists 2.0.0 release writeup). TSM already holds an ion token with an opt-in path, but a GeoLibre pilot should stay on the MapLibre/3D-Tiles layer to avoid a token gate.
- MapLibre GL JS is the default renderer with globe projection support — consistent with TSM's MapLibre-first posture.

### Offline use

- PWA install + **"Download Offline Area"** + service-worker caching; desktop Tauri app is fully local. Caveat from the RustGIS comparison (project-authored): **some features need a remote host** (GDAL export, ONNX detection, story-map HTML export). Core viewing/processing is offline-capable.

### iOS / older-iPhone fit

- **Native iOS app on the App Store** (Tauri v2 mobile), responsive touch layout — the only one of the two with any mobile story. Fits the user's 375px viewport concern better than any desktop-only tool. *(UNVERIFIED: actual UX quality on an iOS-15-era device; the oldest-supported iOS version is not published on the pages read.)*

### TSM-relevant extras

- **Federal Web Services plugins:** FEMA NFHL (WMS), USGS 3DEP DEMs, USGS National Map, USGS NLDI flowline tracing, USGS LiDAR, NASA Earthdata — all align with TSM's source stack.
- Embed-friendly URL parameters (`?data=`, `?url=`, `maponly`, `layout=viewer`) and a versioned postMessage API — a pilot could load TSM-hosted layers in an iframe without embedding the app.

---

## 2. RustGIS (Apache-2.0)

**What it is:** a single native Rust program (egui/wgpu/tiny-skia, no browser engine or JS runtime inside), also compiled to WebAssembly for the browser. Ribbon UI, scriptable command engine (`rustgis-cli`, Python package, MCP server), sandboxed WASM plugins. **18–30 MB download**, one program.

**Licensing / lock-in:** Apache-2.0. No token gates mentioned anywhere on the official pages. **Zero-lock-in fit: excellent.**

### LiDAR point-cloud viewing/processing

- **Reads LAS, LAZ, COPC natively** (desktop); LiDAR point layers are a first-class layer type.
- The 1,000+ GeoLibre/Whitebox suite is available **through an optional desktop runner or an on-demand WebAssembly runner in the browser** — i.e., indirect, runner-dependent availability ("the list depends on the runner").
- GPU rendering backend is **beta and off by default**; the globe, view effects, and exports render on CPU regardless.

### 3D terrain / buildings

- Native globe, **terrain-draped tilted views**, 2.5D extrusion, LiDAR point layers. Per the comparison page, it does **not** have GeoLibre's Cesium globe, I3S, Gaussian splats, or Google Photorealistic 3D Tiles — its 3D is its own native renderer.

### Offline use

- Strong: one native program, large files read "a view at a time," local readers/built-in tools/rendering work without network. No mobile/PWA story. SQL pane is desktop-only (web app has no SQL engine yet).

### iOS / older-iPhone fit

- **No mobile app and no touch-first layout** (per the project-authored comparison). The browser build works in a phone browser in principle, but nothing is touch-optimized — this is the weakest fit for the user's iPhone, the primary device constraint in this assessment.

### Maturity caveat

- "Released its first version in 2026; many features are first versions and **some workflows will have gaps**." Newer and narrower than GeoLibre.

---

## 3. Head-to-head for TSM's workflow

| Criterion | GeoLibre | RustGIS |
|---|---|---|
| LiDAR view + process in one place | LiDAR layer + Whitebox LiDAR tools in-browser, LAS/LAZ/COPC in and out | LAS/LAZ/COPC read natively; Whitebox only via optional runner |
| 3D Tiles / buildings | Dedicated 3D-Tiles + I3S + glTF layers; Cesium optional (ion token) | No 3D-Tiles/I3S ingest; own globe + 2.5D extrusion |
| Terrain from 3DEP | USGS 3DEP DEM plugin; USGS LiDAR COPC clip plugin | COG/GeoTIFF rasters, shaded-relief symbology, terrain drape |
| Offline | PWA + offline areas + desktop; some exports need host | Strongest offline (single native binary) |
| iOS / 375px mobile | Native iOS app, touch layout | No app, no touch layout — weakest |
| Scripting/pipeline fit | Python/R packages, Jupyter widget, MCP, embed API | CLI + Python + command engine; better for CI/batch |
| Lock-in | MIT, self-hostable, no token (Cesium pane excepted) | Apache-2.0, no tokens anywhere |
| Flood data reach | FEMA NFHL, USGS NLDI, 3DEP, National Map plugins | NWS/3DEP reach weaker (some via NASA Earthdata discovery) |

---

## 4. Recommendation

**Pilot GeoLibre, not RustGIS — GeoLibre only, scoped to viewing + LiDAR processing.**

Rationale: GeoLibre is the only one of the two with a native iOS app and touch layout (the user's primary device), a purpose-built LiDAR layer with in-browser Whitebox LiDAR processing and LAS/LAZ/COPC round-trip, a 3D-Tiles layer that could carry TSM's existing LOD2 output, and pre-built FEMA NFHL / USGS 3DEP / USGS NLDI / USGS LiDAR plugins matching TSM's source stack. RustGIS is a strong offline desktop GIS, but it is first-version software with no mobile story and no 3D-Tiles ingest — it doesn't clear the bar for TSM's user-facing workflow right now. It remains a plausible *later* desktop companion for scripted batch work (`rustgis-cli` in CI), if that need ever materializes.

### Proposed pilot (assessment only — no code yet)

1. **LiDAR smoke test:** take one TSM LOD2/3DEP study tile, load the LiDAR (COPC or EPT) into GeoLibre Web via `?data=` from a TSM-hosted URL, run a Whitebox LiDAR classification/ground-filter tool in-browser, and compare the output against the pipeline's reference result.
2. **3D-Tiles check:** serve the LOD2 building GLBs as a 3D-Tiles layer (or point GeoLibre at a tileset from the 3D-tiles pipeline) and compare the viewer UX against TSM's Model Lab on the same data.
3. **Mobile pass:** run both tests on the iPhone at 375px (web build and/or the iOS app) and score legibility, pan/zoom smoothness, and whether the Whitebox WASM tools actually execute there.
4. **Publish rule:** no integration, no vendoring, no changes to TSM's own viewers unless the pilot shows a clear win on the user's actual device. TSM's MapLibre-first, opt-in-Cesium posture stays unchanged regardless.

### Open questions to settle in the pilot (UNVERIFIED now)

- Whitebox WASM full-suite support on iOS Safari / the iOS app.
- GeoLibre's oldest-supported iOS version (user's device is iOS-15-era).
- Performance on multi-GB county-scale LiDAR (docs note "big files still choke a browser tab, so the desktop build exists for those").
- `.geolibre.json` project interoperability with TSM's evidence-registry provenance requirements.

## 5. Sources consulted

- [geolibre.app](https://geolibre.app) — homepage, "What ships today" (crawled 2026-10-23)
- [geolibre.app/data-formats/](https://geolibre.app/data-formats/) — Supported Data Formats
- [geolibre.app/user-guide/plugins/](https://geolibre.app/user-guide/plugins/) — Plugins & Marketplace (federal Web Services plugins)
- [rustgis.app/comparison/geolibre/](https://rustgis.app/comparison/geolibre/) — RustGIS-authored GeoLibre comparison (October 2026)
- [rustgis.app/comparison/](https://rustgis.app/comparison/) — full comparison vs GeoLibre/QGIS/ArcGIS
- [github.com/opengeos/RustGIS](https://github.com/opengeos/RustGIS) — repo tour, releases (GPU beta, COPC/LAS/LAZ support)
- [spatialists.ch/posts/2026/07/14-geolibre-200-released/](https://spatialists.ch/posts/2026/07/14-geolibre-200-released/) — GeoLibre 2.0.0 feature list (Cesium ion token note)
- [toknow.ai/posts/geolibre-browser-gis-ai-assistant/index.pdf](https://toknow.ai/posts/geolibre-browser-gis-ai-assistant/index.pdf) — overview (2026-08-28; version numbers there are already stale — treat 2.8.0 as outdated)
- [botmonster.com/web-dev/geolibre-open-source-gis-in-the-browser/](https://botmonster.com/web-dev/geolibre-open-source-gis-in-the-browser/) — deck.gl/3D-Tiles notes
- Licenses per task statement (MIT for GeoLibre, Apache-2.0 for RustGIS); consistent with everything read above (no contradiction found).
