# Cinematic Engineering Experience

**Route (web):** `/cinematic-engineering`  
**Model:** `packages/geo/src/cinema/CinematicEngineeringModel.ts`  
**UI:** `tsm-console/src/routes/CinematicEngineeringExperienceView.tsx`  
**Windows harness:** `node scripts/native/windows-cinematic-release-test.mjs`

## Features

- Animated camera path over Posey / Bonebank pin
- WSE keyframes: minor flood (MTVI3), modeling BFE, 1937 crest
- Freeboard and bathtub depth math
- Stream layer contracts: Terrain-RGB, NFHL MVT, 3D Tiles, GLB
- Cinematic presets (solar/weather) — PRESENTATION
- Gage discipline: stage + **318.59** NAVD88 zero for MTVI3 only

## Mathematics

- `freeboard = LAG − BFE`
- `depth = max(0, WSE − ground)`
- `WSE_NAVD88 = stage + gage_zero` (product-matched station)
- 1937: `59.21 + 318.59 = 377.80` ft NAVD88

## Native

UE binds the same path/stream contracts via staged TSMData and Sequencer.  
Independent Windows claim requires Shipping artifact + harness PASS.

Human authority remains final.
