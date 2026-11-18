# TSM external geospatial and rendering technology review — 2026-11-17

**Scope:** 42 supplied links (GeoLibre repeated), including repositories, CVE, vendors and documentation. This is a source/repository metadata and targeted primary-documentation review, **not** a benchmark or exhaustive source-code audit. No external project is automatically authorized as an upstream data authority, license for a paid dependency, or a regulatory determination.

**System boundary:** Public React/Vite MapLibre/Cesium experience; independent Unreal 5.8 Windows 11 x64 Shipping executable that runs entirely offline with local, checksum-bound assets; headless data ingestion, analysis, conversion and build processes. No localhost service, WebView or Node requirement for the independent native application. Distinguish measured source data from derived and hypothetical flood scenarios; preserve EPSG:2966 / NAVD88 provenance.

## Implemented in this branch

- Extend scripts/geospatial/audit_offline_parcel_manifest.py with **opt-in** --check-geometry: inspect actual projected polygon topology, detect emptiness, non-finite bounds, nonpositive areas, and self-intersections; record source objectid and **review-only** Shapely make_valid candidate type and fractional planar area change. Never replace authoritative geometry.
- Test valid and self-intersecting source geometries in tests/geospatial/test_offline_parcel_geometry_quality.py, including immutable original file bytes and explicit NOT_RUN status for legacy-only audit.
- Run these synthetic tests under .github/workflows/tsm-geospatial-ci.yml. Synthetic fixture passes do not prove that all Posey parcel geometries have been inspected; the actual staged layer manifest needs a separate offline run.
- picomatch security finding is covered by previously merged #646; inspected root/console npm lockfiles had patched lines (2.3.2 and 4.0.7) for CVE-2026-33672, not an exemption from other npm audit findings.
- TSM already has configurable Cesium building screen-space error and a cache limit. Avoid parallel second tile engines until real FPS, VRAM, GPU, network and rendering correctness comparisons exist.

## High-value next integration, in priority order

1. **Run actual projected parcel topology audit** against the staged EPSG:2966 layer manifest; retain source hashes, feature IDs, validity reasons and candidate area deltas. Obtain human-reviewed resolution of the known geometry exceptions and FEMA coverage exceptions; do not rewrite NFHL or cadastral source.
2. **Instrument per-renderer tile cache saturation and adaptive quality:** for fixed hardware and camera path, record FPS, VRAM, tile requests, screen-space error, error states and fallback geometry. NASA 3DTilesRendererJS explicitly warns that full LRU cache can stop refinement; Cesium has separate caches and knobs, so copy the diagnostic concept rather than assuming identical APIs.
3. **Keep canonical renderer boundaries:** CesiumJS for the 3D public viewer, MapLibre for 2D/2.5D public interaction, Unreal Cesium for independently packaged native 3D. Third-party Three.js loaders would be optional sandbox experiments only.
4. **Versioned project/layer manifest:** borrow GeoLibre/TerriaJS ideas of local PMTiles/COG/GeoParquet support, layer provenance and reproducible project manifests. Native Windows must stage decoders and all files, not lazily fetch hosted WebAssembly, tiles or a localhost sidecar.
5. **Offline mesh quality pass:** benchmark upstream Open3D voxel/outlier processing and mesh QA on headless, immutable lidar footprints; never use mesh simplification results as survey-certified parcel boundaries. Preserve roof/ground height residuals and LoD identities.
6. **Headed end-to-end evidence:** Cypress must prove terrain, buildings, screening, menu collapse, cinematic navigation, memorial, gauge fallback and failure-state visibility. Use separate native Windows headed tests for offline Shipping; static build hashes alone are insufficient.

## Repository-by-repository decision register

Decision keys: **Adopt pattern** = design/QA technique, not a code transplant; **Evaluate** = prototype separately, with license and hardware review; **Do not integrate** = incompatible, unrelated, stale, or licensing risk under present release requirements.

### Cesium, 3D and tile rendering

| Supplied project | Decision | TSM-specific reason / gate |
| --- | --- | --- |
| https://github.com/CesiumGS/cesium | Adopt pattern, already core | Keep authoritative CesiumJS imagery layer and tile APIs; test render lifecycle and request throttling on headed CI. |
| https://github.com/CesiumGS/cesium-native | Adopt pattern, already via integration | Model geometric error, SSE selection and eviction; do not infer local data completeness from a working network demo. |
| https://github.com/CesiumGS/cesium-unreal | Adopt pattern, already UE-specific | Audit Runtime versus Editor plugin dependencies, local raster/3D Tiles, clean air-gap Windows launch. |
| https://github.com/NASA-AMMOS/3DTilesRendererJS | Evaluate benchmark only | Three.js/Babylon renderer supports 3D Tiles; LRU size caps can halt refinement, so test diagnostics and fallback before any adapter. Apache-2.0 metadata. |
| https://github.com/3dcitydb/3dcitydb-web-map | Adopt pattern | City object semantics and feature-to-source identity. Existing 3DCityDB v5 exporter compatibility must not be assumed. Apache-2.0 metadata. |
| https://github.com/reearth/reearth-visualizer | Adopt pattern | Layer styling, scene/story and collapsible tool design; not a second Cesium app. Apache-2.0 metadata. |
| https://github.com/TerriaJS/terriajs | Adopt pattern | Catalog descriptors, layer status, provenance and public static accessibility. Do not replace TSM runtime. Apache-2.0 metadata. |
| https://github.com/nytimes/three-loader-3dtiles | Do not integrate | Older loader with no verified SPDX license in GitHub metadata; prefer current native Cesium or NASA renderer benchmark. |
| https://github.com/geo-data/cesium-terrain-builder | Evaluate headless export | Terrain output must pass CRS, vertical-datum, water/no-data seam and tile validator tests; repository appears less active than Cesium core. |
| https://github.com/CesiumGS/cesium-materials-pack | Do not integrate | GitHub archive dated 2017; use maintained Cesium materials/shaders and native UE visual system. |
| https://github.com/CesiumGS/cesium-workshop | Adopt test ideas | Public city feature inspection and tutorial samples, not authoritative data. |
| https://github.com/openlayers/ol-cesium | Do not integrate | OpenLayers/Cesium bridge is redundant with TSM's MapLibre/Cesium architecture. |
| https://github.com/bilawalsidhu/gods-eye-view | Evaluate isolated visual reference | 3D situational overlays and interaction techniques, but no uncontrolled real-time OSINT tracking, Google tiles/key dependence or license-uncertain code transplant. |
| https://github.com/AnalyticalGraphicsInc/czml-writer | Adopt format pattern | Deterministic CZML replay format for time-indexed gauges/simulations; a Java writer is not necessary for existing TS/Python stack. |

### Data fabric, geometry, terrain and geocoding

| Supplied project | Decision | TSM-specific reason / gate |
| --- | --- | --- |
| https://github.com/opengeos/GeoLibre | Adopt pattern | Local project manifests, cloud-native PMTiles/COG/GeoParquet, client-side DuckDB-WASM, layer save/reopen. GeoLibre has optional network/sidecar behavior: do not assume native air-gap safety. MIT metadata. Listed twice by requester. |
| https://github.com/mbloch/mapshaper | Evaluate headless derived display tiles | Topology-aware simplification and clean candidate diagnostics. Retain original authoritative boundaries and measure area/edge drift; inspect MPL-2.0 license before bundling. |
| https://github.com/geopandas/geopandas | **Applied** Shapely approach | Non-mutating geometry validity/repair-candidate diagnostics. Do not treat make_valid output as regulatory geometry. BSD-3-Clause metadata. |
| https://www.open3d.org/ | Evaluate | Headless lidar point-cloud outlier, voxel and roof-plane/mesh QA, with residual metrics. |
| https://github.com/ATphobia22/Open3D.git | Evaluate as user fork | Check fork content, provenance and actual build/dependencies before direct use; GitHub metadata license was NOASSERTION. |
| https://github.com/uber/geojson2h3 | Evaluate analytics only | H3 aggregation for nonregulatory monitoring/LOD density; hex cells must never substitute for exact parcels or NFHL polygon intersections. Apache-2.0 metadata. |
| https://github.com/geopy/geopy | Evaluate limited lookup | Optional place/geocode matching with cache and published provider terms; do not replace official cadastral IDs. MIT metadata. |
| https://github.com/geocoder-php/Geocoder | Do not integrate | PHP runtime not in TSM's Python/TS/UE stack. |
| https://github.com/blevesearch/bleve | Evaluate separately | Go full-text, numeric and geo search indexing; only useful if there is a measured offline search gap. |
| https://github.com/geotools/geotools | Evaluate data interoperability only | Mature Java CRS/OGC tooling; LGPL-2.1 metadata means obligations and Java runtime must be reviewed before distribution. |
| https://github.com/P3TERX/GeoLite.mmdb | Do not integrate | IP-derived location is not accurate cadastral georeferencing; introduces privacy/source license issues. |
| https://github.com/jQueryGeo/geo | Do not integrate | Legacy jQuery mapping layer duplicates the current renderer. |
| https://github.com/Oldcircle/geo-sleuth | Do not integrate | Photo geolocation/OSINT is not a public civil-engineering evidence chain and creates privacy risk. |
| https://github.com/h9zdev/GeoSentinel | Do not integrate | Global ship/flight tracking is outside the TSM authorized flood/geotechnical scope; no verified SPDX license in metadata. |
| https://github.com/GEO-optim/GEO | Do not integrate | Here "GEO" means generative-engine search optimization, not geographic-coordinate optimization. |
| https://www.fastgeo.com/product | Evaluate **licensed API** only | Geological core-logging/assay/sensor integrations and multimodal lakehouse concept. Vendor product, not freely redistributable source; qualify pricing, API access and offline licensing. |
| https://fastgeo.net/ | Hold — identity/data not verified | Site was not reliably retrievable in this review. Do not conflate with fastgeo.com or import it as a supplier. |

### Build, tests, security and documentation

| Supplied project/site | Decision | TSM-specific reason / gate |
| --- | --- | --- |
| https://nvd.nist.gov/vuln/detail/CVE-2026-33672 | Applied via #646 baseline; monitor | POSIX character-class method injection in picomatch. Patched 2.3.2, 3.0.2, 4.0.4. Audit concrete installed versions and disallow user-controlled glob patterns. |
| https://github.com/micromatch/picomatch | Keep patched transitive dependency | Verify nested lockfiles; don't blindly replace toolchain with latest major to satisfy a scan. MIT metadata. |
| https://www.cypress.io/how-it-works | Adopt existing headed QA | Assert real control states and screenshots with environment/error diagnostics; preserve failures, no forced clicks that hide disabled controls. |
| https://github.com/vitest-dev/vitest | Evaluate bounded unit-test pilot | Useful for pure TS math/renderer state; do not migrate existing Node or Cypress suites without evidence of benefit. MIT metadata. |
| https://github.com/vitejs/vite | Keep as existing build foundation | Maintain pinned security patches and reproducible lockfiles. MIT metadata. |
| https://github.com/voidzero-dev/vite-plus | Evaluate separately | New unified toolchain is a potential build-speed experiment, not an immediate release-time migration. MIT metadata. |
| https://github.com/vitejs/awesome-vite | Reference only | Curated examples, not runtime library. |
| https://github.com/vuejs/vitepress | Evaluate documentation only | Static documentation generation if needed, not another runtime UI. MIT metadata. |
| https://github.com/alex8088/electron-vite | Do not integrate in native Shipping | Electron/Node/WebView contradict independent UE Windows offline executable requirement. Could be a separate legacy developer console. |
| https://github.com/electron-vite/electron-vite-vue | Do not integrate | Vue/Electron boilerplate duplicates React app and conflicts with native no-WebView scope. |
| https://worldbld.com/ | Evaluate licensed editor workflow only | CityBLD/RoadBLD procedural assets could help creative scenes if lawful license and offline export proved; do not make paid plugin/network activation a public runtime dependency. |

## Acceptance evidence required before declaring improvements shipped

- **Reproduce data:** original authoritative source URL, acquisition/publication timestamps, SHA-256, horizontal/vertical CRS, source feature count and footprint; topological findings identified by objectid; no silent "clean".
- **Performance:** fixed camera/hardware/driver and identical dataset, headed FPS/VRAM and tile throughput before/after; no synthetic benchmark described as measured.
- **Public viewer:** green latest-HEAD lint/TS/node contracts and Cypress headed terrain/buildings/screening/camera tests, with Pages deployment.
- **Native:** actual UE5.8 Win64 Shipping build/cook/package log; staged local TSMData hash and datum manifest; clean offline Windows 11 executable launch; headed menus, terrain and 3D Tiles screenshots; no localhost/WebView/Node.
- **Governance:** derived scenarios are labeled and not FEMA/NFIP determinations; human authority final; upstream OSS licenses and third-party dataset terms documented.

### Primary source pointers

- https://github.com/advisories/GHSA-3v7f-55p6-f55p
- https://geopandas.org/en/stable/docs/reference/api/geopandas.GeoSeries.make_valid.html
- https://mapshaper.org/docs/guides/topology.html
- https://github.com/NASA-AMMOS/3DTilesRendererJS
- https://cesium.com/learn/unreal/unreal-faq/
- https://geolibre.app/user-guide/adding-data/
- https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/624
