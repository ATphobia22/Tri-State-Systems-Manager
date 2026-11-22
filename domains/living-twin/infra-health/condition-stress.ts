/**
 * Infrastructure Condition / Stress model.
 * Adapted from AdvancedDamageSystem multi-system wear mechanics.
 * Pure, deterministic, presentation-only.
 */

export type AssetType = "pump" | "berm" | "gauge" | "culvert" | "road" | "levee";

export interface SystemState {
  condition: number; // 0..1 remaining life
  stress: number;    // 0..1 accumulated misuse
}

export interface OperatingEvent {
  type:
    | "normal_use"
    | "overload"
    | "overheat"
    | "cold_start"
    | "flood_loading"
    | "deferred_maintenance"
    | "inspection";
  severity: number; // 0..1
  hours: number;
}

export const SYSTEM_KEYS = [
  "structural",
  "hydraulic",
  "electrical",
  "foundation",
  "instrumentation",
] as const;

export type SystemKey = (typeof SYSTEM_KEYS)[number];

/**
 * Apply an operating event to a single system.
 * Stress only rises from misuse events. Condition decays slowly with use + stress.
 */
export function applyOperatingEvent(
  state: SystemState,
  event: OperatingEvent,
  reliabilityFactor: number = 1.0
): SystemState {
  if (state.condition < 0 || state.condition > 1 || state.stress < 0) {
    throw new Error("invalid system state");
  }

  let { condition, stress } = state;
  const factor = Math.max(0.3, Math.min(1.5, reliabilityFactor));

  switch (event.type) {
    case "normal_use":
      condition = Math.max(0, condition - 0.001 * event.hours / factor);
      break;
    case "overload":
    case "flood_loading":
      stress = Math.min(1, stress + 0.08 * event.severity * event.hours);
      condition = Math.max(0, condition - 0.004 * event.severity * event.hours / factor);
      break;
    case "overheat":
    case "cold_start":
      stress = Math.min(1, stress + 0.05 * event.severity * event.hours);
      break;
    case "deferred_maintenance":
      stress = Math.min(1, stress + 0.02 * event.hours);
      condition = Math.max(0, condition - 0.0015 * event.hours / factor);
      break;
    case "inspection":
      // inspection itself does not change state; repair does
      break;
    default:
      break;
  }

  // Stress accelerates condition loss once above threshold
  if (stress > condition) {
    condition = Math.max(0, condition - 0.01 * (stress - condition));
  }

  return { condition, stress };
}

/**
 * Perform a maintenance action that reduces stress and partially restores condition.
 */
export function applyMaintenance(
  state: SystemState,
  kind: "routine" | "repair" | "overhaul"
): SystemState {
  switch (kind) {
    case "routine":
      return {
        condition: Math.min(1, state.condition + 0.02),
        stress: Math.max(0, state.stress * 0.7),
      };
    case "repair":
      return {
        condition: Math.min(1, state.condition + 0.15),
        stress: Math.max(0, state.stress * 0.3),
      };
    case "overhaul":
      return {
        condition: Math.min(1, state.condition + 0.45),
        stress: 0,
      };
    default:
      return state;
  }
}

/**
 * Probability of a functional failure in the next hour given current state.
 * Used only for scenario visualization, never for regulatory claims.
 */
export function failureProbabilityPerHour(state: SystemState): number {
  if (state.condition <= 0) return 1;
  const margin = Math.max(0, state.condition - state.stress);
  return Math.min(1, Math.exp(-8 * margin) * 0.05);
}
