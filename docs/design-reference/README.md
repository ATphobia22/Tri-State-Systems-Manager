# iOS Design Reference

Concept renders supplied by the project owner (generated in Gemini Notebook).
**Status: concept mockups — not implemented UI.** They capture the intended
visual direction for the TSM iOS app; do not treat any values shown in them as
engineering data.

## `tsm-3d-openworld-mockup.jpg`

iPhone render of a "TSM 3D OpenWorld" app concept: a 3D river-valley map view
with a layer panel (Layers, FEMA BFE, H3 Grid, 3D Tiles), a live USGS feed
status pill, a NAVD88 readout, and an "Engineering Panel" bottom sheet with
action tiles (Berm Placement, Road Construction, Flood Simulation). Useful as a
target for the MapLibre/3D-Tiles mobile layout and the engineering-panel UX —
but none of this UI exists in the codebase yet.

## `levee-cross-section-diagram.jpg`

3D cutaway diagram of a levee cross-section concept: clay core, silty-sand
aquifer, bedrock, phreatic seepage line with flow arrows, and a status panel
(Safety Factor 1.42, Seepage Velocity 0.05 ft/day, Pore Pressure High, System
Status Alert). **The numeric values are illustrative render values, not survey
or model output** — never use them as evidence. Useful as a visual-direction
reference for the engineering vertical-section visualization
(`EngineeringSectionCutaway`); the repo's fail-closed doctrine applies: a
render is not evidence.
