/**
 * SPH / particle fluid surface adapter stub.
 * Research path only. Integrates with existing Three.js / Cesium surfaces.
 * Never mutates hydro evidence packages.
 */

export interface FluidProperties {
  viscosity: number;
  density: number;
  flowRate: number;
  timeStep: number;
}

export interface SphParticle {
  position: [number, number, number];
  velocity: [number, number, number];
  density: number;
}

export interface SphSimulationConfig {
  particleCount: number;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  fluid: FluidProperties;
  presentationOnly: true;
}

/**
 * Placeholder: real SPH solver would live behind this interface.
 * Current implementation returns an empty particle set so callers can wire UI.
 */
export function createEmptySphState(config: SphSimulationConfig): {
  particles: SphParticle[];
  config: SphSimulationConfig;
} {
  if (!Number.isSafeInteger(config.particleCount) || config.particleCount < 0 ||
      config.presentationOnly !== true ||
      config.bounds.min.length !== 3 || config.bounds.max.length !== 3 ||
      !config.bounds.min.every((value, i) => Number.isFinite(value) &&
        Number.isFinite(config.bounds.max[i]) && value < config.bounds.max[i]) ||
      !Number.isFinite(config.fluid.viscosity) || config.fluid.viscosity < 0 ||
      !Number.isFinite(config.fluid.density) || config.fluid.density <= 0 ||
      !Number.isFinite(config.fluid.flowRate) ||
      !Number.isFinite(config.fluid.timeStep) || config.fluid.timeStep <= 0)
    throw new Error("Invalid presentation-only SPH configuration");
  return {
    particles: [],
    config: { ...config, presentationOnly: true },
  };
}
