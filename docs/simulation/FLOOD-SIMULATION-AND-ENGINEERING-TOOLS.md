# Flood simulation, animation, and engineering tools

**Authority:** `SIMULATION_DEMO` / PRESENTATION  
**Policy:** Technology informs people; it does not silently govern people. Human authority remains final.

## Existing UI

| Module | Path | Role |
|--------|------|------|
| FloodSimulator | `tsm-console/src/components/FloodSimulator.tsx` | Interactive flood simulation UI |
| FloodScenarioAnimation | `tsm-console/src/components/FloodScenarioAnimation.tsx` | Human-triggered canvas rise to sourced crests |
| floodScenario catalog | `tsm-console/src/digital-twin/floodScenario.ts` | Scenario IDs / crest provenance |
| canvas flood layer | `tsm-console/src/lib/canvas-flood-layer` | Mask + paint helpers |
| Engineering sim settings | `EngineeringSimSettings.tsx` | Operator sim controls |

## Engineering toolkit (2026-11-08)

`tsm-console/src/lib/flood-engineering-toolkit.ts`

- `computeFreeboardFt(LAG, BFE)` → modeling freeboard (Bonebank default **+2.2 ft**)
- `inundationDepthFt(ground, WSE)` → bathtub depth
- `buildWseAnimationKeyframes` → eased animation series
- `summarizeBonebankScenario` → bundled demo for BFE / 1937 crest

**Not claimed:** LOMA approval, certified LAG, HEC-RAS regulatory runs, or auto warnings.

## Animation rules

- Human-triggered play only (no auto-play as a warning system).
- Only **sourced** crest elevations animate (see `resolveAnimationTarget`).
- Terrain grid in the animation component is **illustrative** except the anchor pad pinned to modeling LAG.

## Tests

`tests/contracts/flood-engineering-toolkit.test.mjs`
