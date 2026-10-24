# Cesium ion Stories research and TSM integration decisions

**Research date:** 2026-10-24  
**Scope:** Publicly accessible Cesium Stories page and official Cesium materials; no account creation, access token, paid service, or private dataset was used.

## Findings from public sources

### Cesium Stories product pattern

The [Cesium Stories page](https://ion.cesium.com/stories) is the entry point to interactive 3D geospatial presentations. Cesium describes Stories as slide-based presentations combining world terrain, user 3D data, metadata styling, measurement tools, and time-dynamic visualization. Authors can add narrative text and imagery, then share or embed the result.

The story-authoring workflow is distinct from the open-source CesiumJS renderer. Uploading data, tiling it through Cesium ion, and streaming ion-hosted assets can require an ion account and token. TSM must not depend on an ion token for its default engineering map or offline mode.

### Relevant examples

- **[Tokyo Metropolitan Digital Twin](https://cesium.com/blog/2024/04/04/tokyo-metropolitan-digital-twin-3d-viewer-uses-cesium/):** Cesium's case study describes a common 3D viewer combining city models, point clouds, transit positions, river data, 2D layers, video, and flood-response context. The article describes displaying anticipated inundation, storm-surge information, terrain, shelters, water levels, rainfall, cameras, and warning status. It also describes before/after point-cloud comparison after a disaster. The reported implementation uses CesiumJS and Cesium ion; it is a design precedent, not a dependency requirement for TSM.
- **[Turkey–Syria earthquake open-data Story](https://cesium.com/blog/2023/05/18/cesium-story-highlights-turkey-syria-earthquake-open-data/):** the case study demonstrates rapid public communication by combining satellite imagery and open data in a narrative, time-updated 3D presentation. It is a useful pattern for evidence-linked incident briefings; the article also notes use of ion-hosted terrain and imagery.
- **[GeoFlood Studio](https://doi.org/10.5281/zenodo.16995576):** the 2025 research record describes an open-source flood-impact visualization tool using calibrated and validated 2D HEC-RAS model outputs, tiled imagery overlays served through Cesium ion, flood-depth and velocity layers, scenario comparison, and vulnerability classification. This supports a separation between hydraulic computation and visualization. It does not mean TSM's models or any proposed results are calibrated or validated by association.
- **[CesiumJS Quickstart](https://cesium.com/learn/cesiumjs-learn/cesiumjs-quickstart/):** the standard quickstart uses a Cesium ion access token to load hosted global terrain and buildings. This must be treated as an optional hosted path, not as a credential-free acceptance test.
- **[Cesium ion architecture](https://cesium.com/blog/2024/08/02/how-cesium-ion-works/):** ion performs upload, tiling, hosting, streaming, and access authorization for hosted geospatial assets. Those managed capabilities should not be conflated with the CesiumJS open-source client or with locally hosted 3D Tiles.

## TSM implementation decisions

1. **MapLibre remains the default 2D engineering map.** It supports the offline-first operational view and should continue to render authoritative layers with explicit attribution and provenance.
2. **CesiumJS remains an optional globe-scale 3D viewer.** Use it for validated local/self-hosted terrain and 3D Tiles without requiring an ion token. Ion-hosted photorealistic content remains opt-in and must fail visibly when its token or service is unavailable.
3. **Use story-style narrative without coupling the core application to ion.** Reusable TSM incident briefings should reference evidence IDs, observation times, source hashes, model-run manifests, uncertainty, and review state. They should not embed private tokens or imply that a visualization is a regulatory determination.
4. **Keep scientific model runs independent from rendering.** HEC-RAS or another solver must produce versioned artifacts and validation evidence before the viewer offers them as model results. A rendering success, HTTP 200, or process exit code is not scientific validation.
5. **Separate observed, derived, scenario, and regulatory layers.** Show distinct timestamps, units, vertical datum, scenario identity, source authority, and quality state. Do not mix modeled flood depth with observed water levels without explicit labeling.
6. **Use local fixtures for account-free CI.** Test tileset JSON, local asset references, hashes, metadata, layer configuration, and viewer fallback without a live ion token. Keep external service checks separate and mark them UNAVAILABLE or SKIPPED when credentials or authorized endpoints are absent.
7. **Do not add a second browser 3D engine just to imitate Stories.** TSM already uses MapLibre and Three.js and has CesiumJS routes; reuse the existing components unless profiling or a defined capability gap justifies another engine.

## Acceptance gates

- [ ] The default map works with no Cesium ion token.
- [ ] Token-backed Cesium content is opt-in, and no token is committed to source control or included in synthetic fixtures.
- [ ] Local 3D Tiles references resolve within the packaged asset tree or to explicitly allow-listed remote origins.
- [ ] The viewer distinguishes observed, derived, scenario, and regulatory layers and displays source time, units, and datum.
- [ ] A solver result is only labeled scientifically validated when its run manifest contains successful validation checks and reviewer evidence.
- [ ] No story, screenshot, or 3D scene is presented as proof of AOI approval, calibration, regulatory status, or engineering certification.

## Source list

- https://ion.cesium.com/stories
- https://cesium.com/platform/cesium-ion/cesium-stories/
- https://cesium.com/blog/2024/04/04/tokyo-metropolitan-digital-twin-3d-viewer-uses-cesium/
- https://cesium.com/blog/2023/05/18/cesium-story-highlights-turkey-syria-earthquake-open-data/
- https://doi.org/10.5281/zenodo.16995576
- https://cesium.com/learn/cesiumjs-learn/cesiumjs-quickstart/
- https://cesium.com/blog/2024/08/02/how-cesium-ion-works/
