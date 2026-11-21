# Design-driven Cesium / BIM review — November 20, 2026

Research inputs:
- [Cesium, November 4: design workflows](https://cesium.com/blog/2026/11/04/new-generation-of-design-driven-applications/)
- [Cesium, November 18: National Digital Twin of Scotland](https://cesium.com/blog/2026/11/18/national-digital-twin-supports-infrastructure-edu/)
- [Verse Engine by Ctruh product](https://www.producthunt.com/products/verse-engine-by-ctruh)
- [CesiumJS November 2026 release notes](https://cesium.com/blog/2026/11/03/cesium-releases-in-november-2026/)

## Technical adoption boundaries

Cesium ion's GA BIM/CAD tiler, Asset Elements API, and georeferencing/clipping assist show a useful design-to-review pattern. BIM hierarchy, snapping, and richer change detection are still labeled experimental or preview. The TSM read-only model review contract implements the **data pattern** without binding a public viewer to proprietary APIs. This does not claim Cesium features are locally installed or that a finished BIM geometry is available.

Verse Engine demonstrates a link-first streaming product with camera-dependent loading and lightweight client rendering. Its 10-billion-triangle and 0.9-second claims are **vendor marketing metrics**, not TSM benchmarks. TSM already includes World Partition/3D Tiles and local layer refinement. Do not upload sensitive parcel or regulated data or switch the offline Win64 engine to a third-party hosted service. Public viewing stays anonymous/free; model-review files are opened locally, not uploaded.

Scotland's digital twin combines infrastructure layers, visual design placement, accessible settings, real sensors and instructional challenges. TSM should preserve that layered approach: show original source, date, authority, age, datum, and distinguish observed vs scenario. A public learning entry point can guide users to camera, layers, gauge replay and hypothetical flood screening with explicit caveats. Do not claim virtual scenario outputs are actual flood predictions.

## Local read-only design package

The browser-side module is tsm-console/src/lib/design-review-workspace.ts. It validates a bounded JSON file, keeps a BIM-style tree, identifies revision changes, and aggregates quantities with explicit units and evidence. Local files must be **4 MiB or less** and cannot contain more than **20,000 elements**. This is a metadata UI and a foundation for future native geometry association; it does NOT import CAD/IFC itself, geolocate meshes, clip terrain, sign evidence, or certify a quantity survey. Source hashes and CONTROL_REVIEWED statuses are declarations from the supplied package, not independent proof. The user interface must never silently upgrade these to verified evidence.

Create metadata only after a reviewed IFC/CAD intake; TSM's existing scripts/geospatial/verify_geobim_ifc_intake.py checks IFC source bytes but intentionally **does not** certify schema, CRS or geolocation. Example (synthetic placeholder, not an actual project):

    {
      "schema": "tsm.design-review.v1",
      "modelId": "example-bridge",
      "revisionId": "concept-a",
      "source": {
        "sourceId": "not-an-official-dataset",
        "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "horizontalCrs": "EPSG:2966",
        "horizontalUnits": "ftUS",
        "verticalDatum": "UNVERIFIED",
        "license": "demonstration-only"
      },
      "placement": {
        "state": "PENDING_EVIDENCE", "controlCount": 0,
        "maxResidualM": null, "toleranceM": null
      },
      "elements": [
        {"id": "bridge", "parentId": null, "title": "Example assembly",
         "category": "Assembly", "quantities": {}},
        {"id": "girder-1", "parentId": "bridge", "title": "Example girder",
         "category": "Girder", "quantities": {
           "volume": {"value": 12.5, "unit": "m3", "evidence": "DERIVED"}
         }}
      ]
    }

The quantity summary excludes missing, incompatible-unit and UNVERIFIED quantities instead of silently treating them as zero. A review diff only compares revisions of the **same** model with the **same** horizontal CRS/units and vertical datum. Element comparison uses persistent source IDs; per-element content changes are not inferred from mesh colors or geometry without metadata. The operator is responsible for checking true model transformations, spatial residuals, semantically equivalent units and baselines before comparing results.

## Publishing and performance

1. Extract source BIM/CAD properties headlessly, preserve original object keys and typed quantity units.
2. Review survey alignment before geometry tiling; verify source CRS, vertical datum, and representative control point residuals; generate a candidate clip polygon for review, never automatically modify effective flood contours.
3. Build HLOD/3D Tiles and preserve stable element-to-feature mappings. Use local PMTiles/3D Tiles where possible; optionally reference cloud Cesium APIs if access and license allow it. Do not manufacture building attributes.
4. Expose local review files in Cesium sidebar; only position geometry once actual approved transform and source assets exist. Consider CesiumJS 1.147 ElementService as optional adapter after a reviewed model and authorized ion connection exists.
5. Continue viewport-driven screen-space error budgets; benchmark requests, cache churn, GPU frame time, memory, and fallback on low-power devices. TSM 60fps Win11 and offline launch remain separate gates.
6. Use self-hosted static public teaching scenarios; never require user logins or payments. Keep engineering calculations labeled informational and authority final.

Validation: run Node 22 test suite in tsm-console with node --experimental-strip-types --test tests/design-review-workspace.test.mjs and npm run check:type. A green JS test does not prove Cesium/IFC native geometry positioning, headed render, or Unreal Shipping.
