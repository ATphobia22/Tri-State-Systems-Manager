# TSM | Cinematic 4D Atlas Experience Design

> **Status:** UX implementation blueprint, 2026-11-13. This document defines proposed interaction behavior and acceptance criteria; it does **not** assert that the behaviors have been implemented or released. The README illustration is original concept art, not terrain, a map, an engineering model, or authoritative data.

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

## Interactive prototype

A keyboard-accessible, responsive, dependency-free [experience preview](../tsm-console/public/experience-preview.html) is included in the Vite public directory. When running the web console locally, open `/experience-preview.html` under the Vite development origin (taking its configured base path into account when hosted). Explore/Simulate/Verify tabs, conceptual layer switches, reset and a visual-only scenario-frame slider work in the browser. This prototype intentionally contains no measurements, downloaded datasets, real world positions or scientific solver calls. GitHub file preview does not execute this HTML; it must be served or opened in a browser.

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
