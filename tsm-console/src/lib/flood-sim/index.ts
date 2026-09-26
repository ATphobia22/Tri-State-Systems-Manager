/**
 * flood-sim/index.ts — public API of the Level-5 flood simulator.
 *
 * Governing axiom: "Technology informs people; it does not silently govern
 * people. Human authority remains final." Every output of this package is
 * labeled `provenance: 'simulation'`; engineering actions require explicit
 * human sign-off and are never auto-applied.
 *
 * Data flow: REST polling only (startGaugePoll from ../river-gauges) plus
 * the local deterministic engine. Push/streaming transports are forbidden
 * in this package — enforced by the source-grep gate test in this directory.
 */

// Deterministic engine (SCS → diffusion-wave → Hazus)
export {
  FloodSimEngine,
  ENGINE_STEP_HZ,
  STEP_DT_SEC,
  FLOOD_SIM_ENGINE_VERSION,
  SIMULATION_PROVENANCE,
  deterministicJson,
} from './engine';
export type {
  FloodSimEngineConfig,
  EngineStructure,
  EngineDamageRecord,
  EngineSnapshot,
  SimulationProvenance,
} from './engine';

// Seeded PRNG
export { mulberry32, seedFromString } from './prng';
export type { Mulberry32 } from './prng';

// Open-world scene kit (pure WebGL — never WebGPU)
export * from './world/index';

// Engineering workbench (pure functions; sign-off gate in the UI)
export {
  lagBfeProbe,
  ARITHMETIC_NOT_SURVEY,
  MITIGATION_ALTERNATIVES,
  getAlternative,
  applyAlternativeToTerrain,
  crossSectionProfile,
  cutFillVolumes,
  wseFromGageHeight,
} from './workbench';
export type {
  SiteConstants,
  LagBfeProbeResult,
  AlternativeId,
  AlternativeSpec,
  CrossSectionPoint,
  CutFillResult,
  GaugeStatus,
} from './workbench';

// Cinematic flythroughs (new keyframe sets; existing cinematic APIs untouched)
export {
  FLOOD_SIM_INTRO_TOUR,
  FLOOD_SIM_OUTRO_TOUR,
  SCENARIO_FLYTHROUGHS,
  scenarioFlythrough,
  INTRO_SHOTS,
  OUTRO_SHOTS,
  TimeLapseDriver,
} from './cinematic';
export type { FloodSimKeyframe, CinematicShot, CameraPose } from './cinematic';

// Scenario registry (JSON in data/scenarios/, schema-validated)
export {
  listScenarios,
  getScenario,
  validateScenario,
  validateAgainstSchema,
  scenarioSeed,
  scenarioToEngineConfig,
} from './scenarios';
export type {
  FloodSimScenario,
  ScenarioEngineSpec,
  ScenarioStructure,
  ScenarioSourcedValue,
} from './scenarios';
