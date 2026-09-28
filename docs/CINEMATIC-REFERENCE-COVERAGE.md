# Cinematic / 3D-Twin Reference Coverage

Comparison of the four uploaded rendering references
(`Box3d_unity.pdf`, `CGI_-_Virtual_Background.pdf`,
`From_Maps_to_Moviesv2.pdf`, `Unreal.pdf`) against the repo's actual
cinematic/3D code (`tsm-console/src/lib/cinematic/`,
`tsm-console/server/cinematic/`, `DigitalTwinMap.tsx`,
`viewport/ThreeGeospatialHarness.ts`, `gpu/ultimate-twin-pipeline.wgsl`,
`lib/hydraulic-rendering.ts`).

Note: the PDFs document work on a different (PTDT v33) codebase, so only
concrete, transferable pieces were credited.

## Covered by existing code

- Render-origin precision pattern (EPSG:2966 → local origin) — `ThreeGeospatialHarness.ts`
- Depth-based water surface + sun/ambient lighting core — `ultimate-twin-pipeline.wgsl`
- MapLibre–Three.js bridge, camera tours, solar math — `src/lib/cinematic/`
- HEC-RAS GeoTIFF ingest — `tsm-console/server/engineering/ras-results.mjs`
  (`POST /api/engineering/ras-results`; the v33 standalone ingest script was
  not carried into this tree)

## Implemented in this build

- **`POST /api/engineering/ras-results`** (`tsm-console/server/engineering/ras-results.mjs`,
  wired into `token-proxy.mjs`, 7 node tests). The ingest script previously
  POSTed to a route that did not exist. Payloads are validated fail-closed
  (422) and stored as `MODEL_OUTPUT` evidence artifacts pending human review.

## Genuine gaps (documented, not built)

These are real but each is a feature-sized build requiring design decisions
beyond a reference port; recorded here so they are not lost:

1. **Derived debris/collision physics** — no rigid-body layer exists; a
   web-native (rapier3d/cannon-es) bridge inside `ThreeGeospatialHarness.ts`
   with a sealed state envelope and zero writes to authoritative SceneState.
   Test: debris transforms advance while SceneState flood fields stay
   byte-identical.
2. **Water shader fidelity** — `ultimate-twin-pipeline.wgsl` lacks
   depth-absorption coloring (exponential ramp), foam edge at shorelines, and
   wave displacement. Test: pixel-sample a synthetic depth grid; shoreline
   band must be foam-white, color exponential not linear.
3. **Velocity-field particles** — no particle system; the screening diffusion
   model exposes depth but no velocity grid. Two-part: emit velocity field
   (or accept via ras-results), add instanced tracer layer. Test: synthetic
   uniform velocity grid → particle displacements parallel/proportional to flow.
4. **Cinematic frame capture / video export** — `playCinematicTour` animates
   only; no clip deliverable for briefings. Piece: tour-recording wrapper
   (`captureStream` + `MediaRecorder`) beside `camera-tour.ts`. Test: headless
   short tour → non-empty playable WebM/MP4 matching tour duration.
5. **Photorealistic render path** — no Cesium/Unreal globe path. Piece: a
   cinematic-mode scene definition (georeference + BFE 375.0 / LAG 377.2 ft
   NAVD88 anchors + ras flood cells) consumable by an external renderer.
   Test: Cesium viewer shows BFE plane at correct georeferenced position.
6. **Solar wiring** — `solar-engine.ts` / `setSolarTime` exist but nothing
   consumes them; no sky dome, height fog, or day/night cycle in the twin.
   Piece: wiring module mapping `SolarLightingState` to renderer light
   uniforms + minimal sky/fog pass. Test: noon vs midnight → light uniforms change.

## Explicitly skipped

Blender/Cycles headless pipeline, Houdini VAT baking, Google Photorealistic
3D Tiles (external API key), OpenMI gRPC coupling, "Moonray-grade"
post-processing claims, Box3D benchmark tables, WebRTC/TURN host tuning
(operational, not repo code), and all Daubert/legal-affidavit framing — vague,
aspirational, or non-applicable to this codebase.
