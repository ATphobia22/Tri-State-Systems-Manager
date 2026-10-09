import type { LightSpecification, SkySpecification } from 'maplibre-gl';

export type CinematicLightPreset = 'day' | 'golden' | 'night';

export interface CinematicLighting {
  readonly light: LightSpecification;
  readonly sky: SkySpecification;
}

const PRESETS: Record<CinematicLightPreset, CinematicLighting> = {
  day: {
    light: {
      anchor: 'viewport',
      color: '#fff7e6',
      intensity: 0.65,
      position: [1.15, 215, 35],
    },
    sky: {
      'sky-color': '#6b7da8',
      'sky-horizon-blend': 0.55,
      'horizon-color': '#dbeafe',
      'horizon-fog-blend': 0.65,
      'fog-color': '#cbd5e1',
      'fog-ground-blend': 0.35,
      'atmosphere-blend': 0.7,
    },
  },
  golden: {
    light: {
      anchor: 'viewport',
      color: '#ffd39a',
      intensity: 0.8,
      position: [1.15, 245, 18],
    },
    sky: {
      'sky-color': '#b86f5b',
      'sky-horizon-blend': 0.7,
      'horizon-color': '#f4b183',
      'horizon-fog-blend': 0.72,
      'fog-color': '#e8b99a',
      'fog-ground-blend': 0.4,
      'atmosphere-blend': 0.75,
    },
  },
  night: {
    light: {
      anchor: 'viewport',
      color: '#9bb7e8',
      intensity: 0.22,
      position: [1.15, 35, 75],
    },
    sky: {
      'sky-color': '#071326',
      'sky-horizon-blend': 0.35,
      'horizon-color': '#24364d',
      'horizon-fog-blend': 0.45,
      'fog-color': '#14243a',
      'fog-ground-blend': 0.2,
      'atmosphere-blend': 0.35,
    },
  },
};

/** Presentation-only MapLibre lighting; never used to infer time or conditions. */
export function getCinematicLighting(preset: CinematicLightPreset): CinematicLighting {
  return PRESETS[preset];
}
