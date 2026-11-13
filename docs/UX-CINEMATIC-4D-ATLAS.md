# TSM | Cinematic 4D Atlas Experience Design

> **Status:** UX implementation blueprint, 2026-11-13. This document defines proposed interaction behavior and acceptance criteria; it does **not** assert that the behaviors have been implemented or released. The README preview is drawn from static, repo-staged source geometry; it is not live telemetry, an engineering model or authoritative hydrologic interpretation.

## Intent

Make the Ohio–Wabash confluence legible as a living, time-aware engineered landscape. Borrow only broad **design patterns**, not copyrighted artwork, from [map UI](https://dribbble.com/search/map-ui), [3D map dashboards](https://dribbble.com/search/3d-map-dashboard), and [simulation UI](https://dribbble.com/search/simulation-ui): a map-first canvas, lightweight floating controls, spatially anchored annotations, rich but quiet hierarchy, and simulation parameters adjacent to results.

The experience should **feel like a cinematic city builder** without presenting gameplay mechanics as professional engineering authority.

### What is already in the repository

- **Web:** React/Vite/TypeScript in `tsm-console/`; MapLibre/Three.js mapping and visualization paths.
- **Native:** Unreal Engine 5.8 C++ and Slate engineering HUD under `tsm-native/`.
- **Geospatial:** government source registry, surveying/geodesy tools, raster/point-cloud and GLB/3D Tiles pipelines.
- **Science:** runoff, hydraulic screening, slope-stability, and source-identified evidence workflows.
- **Assurance:** provenance manifests, source timestamps, SHA-256 receipts, missing-evidence states, tests and release gates.

Source code existing is not proof of a working, complete, signed, or validated distributed application.

## Actual repository-connected implementation

The [4D Atlas route](../tsm-console/src/routes/TriStateAtlasView.tsx), registered as `/atlas` in [React Router](../tsm-console/src/lib/router.tsx), now composes the **real** [TriStateDigitalTwinMap](../tsm-console/src/components/TriStateDigitalTwinMap.tsx) and [RiverGaugeBoard](../tsm-console/src/components/RiverGaugeBoard.tsx). No second mock map or fake flood timeline is used.

- **Actual map:** existing MapLibre source adapters, MapPlane Fabric controls, IGIO imagery/roads/parcels/building footprints, FEMA NFHL effective, Indiana DNR planning, 3DEP indexes and provenance-aware optional terrain. Runtime availability depends on source access and deployment environment; layer registration is not proof of retrieval.
- **Real-time on demand:** the station board calls the existing TSM hydrology API `/api/hydrologic/community` **only after the user presses Fetch live snapshot**. Each response retains site, provider, units, observation and retrieval timestamps, qualifier and provisional status. It fails visibly if the TSM backend is not configured or reachable. No live values are guessed and the browser does not directly contact providers.
- **Cinematic:** selectable visual lighting presets on an actual geospatial map, with no claim that lighting is atmospheric measurement.
- **Scientific work:** direct navigation into the existing flood-sim, engineering section, cinematic engineering, site-calculation and evidence routes. No new undocumented solver or reclassification of simulated output.
- **Data fabrics:** actual exported `TSM_DATA_FABRICS` and `MAP_PLANE_FABRIC` inventories, with source/authority/module/limitations revealed in the UI. Flags `implemented` and `live` describe registered capability, **not** live source health or validation of delivered data.
- **Accessibility:** responsive layout, accessible keyboard controls, map alternative descriptions, visible focus, minimum touch-target design, high contrast and `prefers-reduced-motion` styling. Screen-reader and hands-on acceptance still require headed verification.

The [README hero](assets/tsm-source-backed-atlas.svg) is a **static, source-derived preview**, built by projecting existing committed georeferenced station coordinates and USACE eHydro survey extents. It explicitly contains no live values or synthetic river channels. This is distinct from the web Atlas itself.

### Runtime and publishing boundaries

GitHub repository READMEs render as static documents. The live React route runs in the built Vite console, not inside the README. The linked Pages destination is `https://atphobia22.github.io/Tri-State-Systems-Manager/atlas` **after a successful deployment**. The route should be smoke-tested as a deep link with the configured Vite base and existing Pages SPA fallback. GitHub Pages alone cannot run the TSM Node API. A same-origin reverse proxy or `VITE_TSM_API_BASE_URL`/runtime configuration is required for live hydrology.

**Not yet independently verified here:** full browser run, mobile/assistive tech acceptance, deployed Pages deep-link behavior, backend connectivity, live USGS snapshots, data licensing/retrieval success, full building height reconciliation, vertical datum, or UE5.8 Shipping/air-gapped installer acceptance.


## Design system

| Token | Value | Application |
|---|---|---|
| Deep canvas | `#071322` | Scene chrome, visual depth |
| Land | `#123345` | Conceptual map surfaces |
| River cyan | `#55E6E0` | River paths or selected layers, never sole meaning |
| Observation teal | `#46C7BB` | Source-qualified observation |
| Scenario amber | `#F3C77C` | Distinguishes modeled scenarios |
| Missing evidence | `#D9A8A8` plus label/icon | Source unavailable, no numeric fabrication |
| Text primary | `#F0F8FC` | High-contrast foreground on dark surfaces |
| Text secondary | `#AEC9D4` | Explanatory metadata |

Use typography, labels, line styles, icons and textual state in addition to color. Define light and dark mode tokens for the deployed console. Never use glass effects that reduce map-label readability.

## Three user lenses

### 1. Explore (public, youth, older adults, newcomers)
- Start from **Where am I looking?** and show an orientation overview, legend, county/state labels and plain-language definitions.
- Big targets (at least 44 × 44 CSS px on touch); legible default text (at least 16 CSS px); text zoom 200%; keyboard-first alternatives; reduced-motion option.
- Two-click stories: river confluence, flood history, parcel context, watershed, agriculture and ecosystems; always link to the underlying source.
- Offer voice/screen-reader-compatible descriptions of map-selected features, plus accessible tabular/list equivalents to all map-only information.
- No account needed for public information; do not require donations, proprietary map tokens or subscriptions.

### 2. Simulate (students, planners, engineers)
- Show **time** as a first-class dimension: observation time vs scenario time vs source publication date. Never put all three on one undifferentiated slider.
- Scenario controls: rainfall/runoff inputs, selected terrain/building/road layers, elevation reference, overlays for inundation and depth; support comparison A/B with input diffs.
- 2D/3D camera toggle, orbit and guided tour, optional cinematic lighting; turn off atmospheric effects in measurement mode.
- For every modeled value, show input parameters, solver, units, assumptions, boundary conditions, computational version and any calibration limitations.
- Render provisional areas as unresolved, not visually filled by interpolation unless a user knowingly enables an *illustrative* fallback.

### 3. Verify (researchers, licensed professionals, peer reviewers)
- Inspection pane: source agency, immutable source ID, source file/URL, spatial coverage, date, CRS/EPSG, vertical datum/geoid, epoch, units, SHA-256, acquisition time and review status.
- Export a review bundle: evidence receipts, exact input manifests, source-to-derived links, calculation recipe, limitations, approvals, and reproducibility instructions.
- One-click **compare effective FEMA vs DNR planning vs modeled scenario** with distinct legends; a planning layer must not masquerade as a regulatory layer.
- Support reviewer annotations and deterministic tests; no automatic agency filing, regulatory approval, or signed professional opinion.
- Present 23,082 source building OBJECTIDs separately from height-linked completeness, terrain coverage and rendered asset counts.

## Navigation contract

```text
HOME / EXPLORE / SIMULATE / VERIFY
         |          |          |
    Layers + Help    |       Evidence
    Search + Camera  |       Source ledger
    Place stories    |       Review & export
                 Time + scenarios
                 Compare + results
```

Desktop shell: global top bar, unobstructed map canvas, left layer explorer, optional right evidence inspector and bottom time strip. Mobile shell: top search/location, map canvas, bottom sheets with clear dismiss affordances. Save workspace locally when allowed; do not require online services for the native offline path.

## Data-state contract (mandatory)

| Label | Meaning | Visual behavior |
|---|---|---|
| OBSERVED | Named observation with source + timestamp | Solid observation mark |
| DERIVED | Reproducible transform with full input chain | Distinct derived icon and provenance |
| SCENARIO | Output from named assumptions/model | Amber, dashed boundary or patterned fill |
| STALE | Exceeded source freshness rule | Warning text with last observation time |
| UNAVAILABLE | Required source missing/unverified | Empty value: **not available** |
| REGULATORY | Published by competent authority | Official source title/edition, not inferred from style |

Do not call a visualization *live* when no active authoritative update was actually retrieved. Gage stage is not NAVD88 water-surface elevation without a verified gage zero; do not mix vertical datums. Label conceptual or demo imagery as illustrative.

## Accessible cinematic behavior

1. **First interaction under 15 seconds** on a representative mid-range device where data is installed: open overview, identify controls, and reach a source card; profile and document the actual measured device/performance.
2. Offer **Guided / Standard / Expert** density settings without withholding scientific context, disclaimers, or source links.
3. Support `prefers-reduced-motion`; pause animation; non-motion-equivalent time readings; color-blind-safe patterns; focus-visible; keyboard controls; screen-reader text for graphs.
4. Make sunrise, fog, rain and bloom visual-only toggles. Measurement views default to clear, reproducible illumination and unambiguous units.
5. Show offline state and last staged snapshot with version, checksum and timestamp. Do not silently connect the native offline installer to a service.

## Implementation notes grounded in research

- **Map engine:** Keep the existing MapLibre + PMTiles stack as the default public/offline-capable base. For actual rendered layers, use `map.getLayer(id)` followed by `map.setLayoutProperty(id, "visibility", enabled ? "visible" : "none")`, not direct mutation of layer object fields. Reapply saved visibility after a style reload; do not hide a missing layer error by implying it is present. See [MapLibre API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setlayoutproperty) and [style layers](https://maplibre.org/maplibre-style-spec/layers/).
- **Tile provenance:** Each source and style layer must link to an evidence receipt, authority class, effective/publication/retrieval date, units and datum. Serve self-hosted PMTiles or local files only when license, attribution, offline support and range requests are verified. See [Protomaps PMTiles integration](https://docs.protomaps.com/pmtiles/maplibre).
- **Mapbox is optional:** The Mapbox plugin can help prototype a basemap or geocode place names, but a proprietary online style, unreleased secret token or uncached third-party tiles must **not** become a required dependency for the free no-login console or Windows offline Shipping build. Any chosen web token must be **public-scoped and URL-restricted**, with attribution and license review; never place a secret token in client code.
- **Citizen-centered choices:** A 2025 [citizen-centric digital-twin study](https://doi.org/10.1108/sasbe-02-2025-0067) highlights trust, accessibility/help, resilience and feedback. Ship progressively disclosed complexity, tooltips, plain language and multi-format help instead of expecting residents to understand GIS jargon.
- **Digital thread:** [OGC's Urban Digital Twins discussion paper](https://docs.ogc.org/dp/24-025.html) describes an interoperable, human-centered bridge between infrastructure, natural environment and people. This is a **discussion paper, not a normative OGC standard**. [Local Digital Twin MIM8 guidance](https://mims.oascities.org/mims-specification-v9.0/local-digital-twins/mim8-local-digital-twins/capabilities-and-requirements) emphasizes source, timestamp, scenario assumptions and workflow provenance.
- **Accessibility:** Target WCAG 2.2 AA; choose **44 × 44 CSS px** for important interactive buttons as a usability target aligned with WCAG 2.5.5 AAA enhanced target size (the WCAG 2.2 AA minimum is 24 × 24, subject to exceptions). Provide keyboard interaction, focus indicators and non-visual geographic descriptions. See [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [GeoVisA11y](https://www.alphaxiv.org/abs/2603.07446).
- **Risk communication:** [Research on uncertainty in thematic maps](https://www.alphaxiv.org/abs/2602.00248) underscores the importance of not reducing confidence to a dramatic flood-color gradient; show unverified or uncalibrated areas with text, pattern and metadata instead.

These references motivate proposed engineering decisions. They are not proof of installed functionality, populated data, runtime accessibility, or professional acceptance.

## Delivery order / acceptance

- **P0:** Evidence state and honest labels; source receipts; 2D navigation; public/no-login access; keyboard/touch/list equivalents; clear FEMA/DNR/scenario distinctions.
- **P1:** Responsive map shell, guided tours, saved views, split-view source inspector, compare mode, source-aware layer controls.
- **P2:** Time-aware scenario timeline, provenance-linked results, reproducible export bundle, large-dataset performance profiling.
- **P3:** Native UE5.8 cinematic tours, terrain/3D Tiles HLOD controls, adaptive graphics, iOS parity, optional offline-first guided learning.

### Independent release gates

An interactive mockup, merged documentation, successful TypeScript tests, or passing PR checks **does not** close the independent gates for: all authoritative building heights; verified DEM vertical units/datum; packaged native `.umap`; UE5.8 Windows Shipping archive; signed offline Windows 11 startup on clean hardware with networking disabled; headed visual tests and FPS/VRAM logs; professional/regulatory certification.

## Visual references and licensing

- [Dribbble — Map UI](https://dribbble.com/search/map-ui)
- [Dribbble — 3D Map Dashboard](https://dribbble.com/search/3d-map-dashboard)
- [Dribbble — Simulation UI](https://dribbble.com/search/simulation-ui)

These are **pattern references only**. The hero SVG is original vector artwork made for TSM, not a copy or a licensed extract of any Dribbble shot. The GitHub README is a static presentation. Deployed interactivity requires separate implementation, testing and hosting/native packaging.
