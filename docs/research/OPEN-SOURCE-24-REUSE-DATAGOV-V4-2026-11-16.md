# TSM 24-source review and Data.gov v4 headless evidence adapter

Reviewed November 16, 2026 for the Ohio–Wabash IN/IL/KY digital twin.

## Implemented: Data.gov v4 catalog discovery

The official [Data.gov API documentation](https://resources.data.gov/catalog-api/) identifies
the current endpoint as https://api.gsa.gov/technology/datagov/v4/search and says it
replaces the legacy CKAN catalog API. [GSA/datagov-catalog](https://github.com/GSA/datagov-catalog)
is a read-only Flask/OpenSearch catalog, not an engineering model or a data originator.
TSM should consume a bounded search API instead of embedding either portal server.

Source: scripts/government/datagov_v4_catalog.py
Contract tests: scripts/government/test_datagov_v4_catalog.py

Offline replay of a previously captured official response:

    python3 scripts/government/datagov_v4_catalog.py --fixture /local/input.json --query "Wabash Ohio River flood" --output-dir /local/evidence/datagov

Repeat --fixture for each page in cursor order.

Connected ingestion is **explicit opt-in**, running only on the trusted headless ingestion host:

    export TSM_DATAGOV_API_KEY="private-operator-key"
    python3 scripts/government/datagov_v4_catalog.py --live --query "Posey County flood elevation" --org-type "Federal Government" --spatial-filter geospatial --max-pages 3 --output-dir /local/evidence/datagov

An operator obtains a free key from api.data.gov. The script requires this private key
for automated live discovery and rejects DEMO_KEY. Key is sent only as X-Api-Key header;
it is not placed in URLs, manifests or source files. The public anonymous viewer
and offline Windows runtime never require credentials. Live fetch has not been exercised
or evidenced in this PR.

### Ingestion evidence and scientific boundaries

- The only network endpoint is the fixed HTTPS GSA v4 search URL; redirect following is
  disabled and the timeout is 20 seconds. Source bytes are read with a two-megabyte cap.
- At most five pages and 50 results/page; v4 pagination uses a bounded 'after' cursor.
  Cursor loops, malformed response shapes and inconsistent fixture pagination fail.
- Saved evidence: byte-exact page-NNN.json files, SHA-256 per raw page, candidates.json,
  and manifest.json in a content-addressed non-overwriting directory. Persisted hashes
  are checked before paths are returned; partial catalog pagination is explicit.
- Normalize the catalog identifier, publisher, DCAT reported issue/modified/access/license
  claims, harvest date and spatial flag. These are source **claims**, not validated inputs.
- No DEM, parcel geometry, HEC-RAS result, regulated NFHL layer, survey elevation or
  engineering-ready building geometry is downloaded or asserted.
- The absence of source CRS, vertical datum, accuracy, units or independent agency
  validation is retained as null. Every candidate is unverified, applicability not
  assessed and engineering use prohibited until independently validated.
- Data.gov catalog harvesting dates are NOT the dataset acquisition dates or the
  effective dates of a flood hazard determination. Report those separately.

## Upstream decisions across all 24 requested repositories

| Repo | Useful method / idea | Decision for TSM |
|---|---|---|
| [ckan/ckan](https://github.com/ckan/ckan) | Open-data portal metadata and harvesting | Reference only; legacy Data.gov CKAN API replaced by v4 |
| [GSA/data.gov](https://github.com/GSA/data.gov) | Federal data catalog provenance | v4 metadata adapter now implemented; no whole server |
| [visgl/luma.gl](https://github.com/visgl/luma.gl) | WebGPU/WebGL2 portable rendering and GPU compute | Benchmark browser atlas renderer, headed, isolated |
| [maptime/map-accessibility-guidelines](https://github.com/maptime/map-accessibility-guidelines) | Map keyboard access, readable legends and alternatives | Apply to UI test plan; check current WCAG/Section 508 separately |
| [uber/h3](https://github.com/uber/h3) | Hierarchical geospatial indexing | Already in TSM Python, TS and PostGIS; do not duplicate |
| [uber/react-vis](https://github.com/uber/react-vis) | React chart component patterns | Reference only; avoid duplicate chart dependencies |
| [codeforamerica/adopt-a-hydrant](https://github.com/codeforamerica/adopt-a-hydrant) | Community infrastructure stewardship | Opt-in observation UX candidate; no anonymous agency edits |
| [opencivicdata/ocd-division-ids](https://github.com/opencivicdata/ocd-division-ids) | Canonical civic division IDs | Candidate jurisdiction crosswalk, subject to source validation |
| [codeforamerica/civic-tech-patterns](https://github.com/codeforamerica/civic-tech-patterns) | Civic UX patterns | Historical UX reference, not compliance proof |
| [YangLing0818/Diffusion-Models-Papers-Survey-Taxonomy](https://github.com/YangLing0818/Diffusion-Models-Papers-Survey-Taxonomy) | Generative model taxonomy | Research only; synthesized geometry is not measured geometry |
| [GeoscienceAustralia/GeodePy](https://github.com/GeoscienceAustralia/GeodePy) | Survey geometry, datum transforms, geoid calculations | Independent math benchmark only; never reuse Australian datums for NAVD88 |
| [OpenStitching/stitching](https://github.com/OpenStitching/stitching) | Headless image stitching | Optional photo-QA experiment, with ground-control residual checks |
| [usnistgov/MIST](https://github.com/usnistgov/MIST) | Microscopy tile registration | Algorithmic research analogy, not airborne-survey calibration |
| [gluon-framework/gluon](https://github.com/gluon-framework/gluon) | Browser and Node desktop shell | Reject: archived and conflicts with native no-WebView target |
| [dataarts/webgl-globe](https://github.com/dataarts/webgl-globe) | Historical lat/lon globe design | Archived visual reference only |
| [LibraryOfCongress/api.congress.gov](https://github.com/LibraryOfCongress/api.congress.gov) | Congressional bills/amendments metadata API | Future separate legislative evidence adapter, key gated |
| [hustvl/4DGaussians](https://github.com/hustvl/4DGaussians) | Time-varying Gaussian splat scenes | Cinematic research, not engineering evidence |
| [mediastormDev/Blender-3DGS-4DGS-Viewer-Node](https://github.com/mediastormDev/Blender-3DGS-4DGS-Viewer-Node) | Offline Blender Gaussian camera inspection | Optional headed previsualization, not source validation |
| [dvdoug/BoxPacker](https://github.com/dvdoug/BoxPacker) | Multidimensional bin packing | Packing optimization is not 4D spatiotemporal simulation |
| [LogosIntelligenceLab/4d-gaussian-splatting](https://github.com/LogosIntelligenceLab/4d-gaussian-splatting) | Dynamic visual scene representation | Rendering research; separate from HEC-RAS physics |
| [EricLengyel/Terathon-Math-Library](https://github.com/EricLengyel/Terathon-Math-Library) | C++ vector/matrix/quaternion and geometry | Math kernel candidate only after independent ECEF/unit tests |
| [wzzheng/StreamVGGT](https://github.com/wzzheng/StreamVGGT) | Streaming visual geometry reconstruction | Research; metric scale and uncertainty gates required |
| [worldbench/awesome-3d-4d-world-models](https://github.com/worldbench/awesome-3d-4d-world-models) | World-model paper review | Bibliography, not executable production dependency |
| [wenqsun/DimensionX](https://github.com/wenqsun/DimensionX) | Image-to-4D generative video | Visual ideas only, never authoritative hydrology |

## Remaining gates

1. Run live source discovery on an authorized host; archive receipts and separately retrieve
   original publisher datasets. Verify licensing, source CRS, NAVD88/GEOID18, accuracy,
   acquisition date and dataset coverage before GIS ingestion.
2. Verify cross-border IN/IL/KY datum transformations with independent check points.
3. Run headed browser keyboard/screen-reader/reduced-motion and GPU visual acceptance.
4. Benchmark any splat pipeline against input photography, GPU memory, and non-fabrication UX.
5. Separately verify full 23,082 building identity and height provenance, terrain/3D Tiles,
   UE5.8 native .umap/Shipping build and clean offline Windows 11 hardware startup.

**No claims:** No upstream repository was vendored; no new runtime dependency was installed.
This adapter does not perform a physical model simulation, download surveyed data,
modify parcels or calculate BFE, or establish a regulatory determination.
