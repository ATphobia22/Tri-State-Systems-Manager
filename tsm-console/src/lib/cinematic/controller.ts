import type { FloodScenarioId, SceneState, SolarLightingState } from './scene-state';
import { DEFAULT_FLOOD_SCENARIOS } from './scene-state';
import { TriStateSolarEngine } from './solar-engine';

export function setActiveFloodScenario(state: SceneState, id: FloodScenarioId): SceneState {
  const exists = state.floodScenarios.some((scenario) => scenario.id === id);
  if (!exists) throw new Error(`Unknown flood scenario: ${id}`);
  return { ...state, activeFloodScenario: id, timestamp: new Date().toISOString() };
}

export function setSolarTime(state: SceneState, date: Date, engine: TriStateSolarEngine): SceneState {
  const solar: SolarLightingState = engine.calculate(date);
  return { ...state, solar, timestamp: new Date().toISOString() };
}

export function createInitialSceneState(): SceneState {
  const engine = new TriStateSolarEngine();
  return {
    schemaVersion: '1.0.0',
    timestamp: new Date().toISOString(),
    orthophoto: null,
    activeFloodScenario: 'live',
    floodScenarios: DEFAULT_FLOOD_SCENARIOS,
    solar: engine.calculate(new Date()),
  };
}
