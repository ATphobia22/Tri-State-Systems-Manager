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
  if (config.particleCount < 0) {
    throw new Error("particleCount must be non-negative");
  }
  return {
    particles: [],
    config: { ...config, presentationOnly: true },
  };
}
