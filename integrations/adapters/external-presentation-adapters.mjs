/**
 * TSM external presentation/compute adapter boundaries.
 * Fail-closed contracts — BOUNDARY_READY without claiming full upstream integration.
 * Authority: PRESENTATION or COMPUTE only. Human authority remains final.
 */

export const EXTERNAL_ADAPTERS = Object.freeze({
  "openusd-houdini-interchange": {
    id: "openusd-houdini-interchange",
    mode: "BOUNDARY_READY",
    authority_class: "PRESENTATION",
    invoke() {
      return {
        ok: false,
        reason: "OpenUSD/Houdini bridge not installed; presentation interchange deferred.",
        authority: "PRESENTATION",
      };
    },
  },
  "opencue-render-farm": {
    id: "opencue-render-farm",
    mode: "BOUNDARY_READY",
    authority_class: "COMPUTE",
    invoke() {
      return {
        ok: false,
        reason: "OpenCue worker not configured; compute farm deferred.",
        authority: "COMPUTE",
      };
    },
  },
  "rayshader-terrain-viz": {
    id: "rayshader-terrain-viz",
    mode: "BOUNDARY_READY",
    authority_class: "PRESENTATION",
    invoke() {
      return {
        ok: false,
        reason: "rayshader is reference visualization only; never authoritative elevation.",
        authority: "PRESENTATION",
      };
    },
  },
  "4d-gaussian-splats": {
    id: "4d-gaussian-splats",
    mode: "BOUNDARY_READY",
    authority_class: "PRESENTATION",
    invoke() {
      return {
        ok: false,
        reason: "4D Gaussian flood replay is SIMULATION_DEMO only; not enabled.",
        authority: "PRESENTATION",
        label: "SIMULATION_DEMO",
      };
    },
  },
});

export function invokeExternalAdapter(id) {
  const adapter = EXTERNAL_ADAPTERS[id];
  if (!adapter) {
    return { ok: false, reason: `Unknown adapter: ${id}` };
  }
  return adapter.invoke();
}

/** Inventory for capability registry / CI — never claims integration complete. */
export function listExternalAdapterStatus() {
  return Object.values(EXTERNAL_ADAPTERS).map((a) => ({
    id: a.id,
    mode: a.mode,
    authority_class: a.authority_class,
    last_probe: a.invoke(),
  }));
}
