import { describe, expect, it } from 'vitest';
import { calculateSolarPosition } from '../src/lib/cinematic/solar-engine';
import { DEFAULT_FLOOD_SCENARIOS, selectFloodScenario } from '../src/lib/cinematic/scene-state';
import { getCinematicLighting } from '../src/lib/cinematic/light-presets';

describe('cinematic state contracts', () => {
  it('keeps the supplied flood scenarios unbound until evidence is attached', () => {
    expect(DEFAULT_FLOOD_SCENARIOS.every((scenario) => scenario.status === 'UNBOUND')).toBe(true);
    expect(selectFloodScenario(DEFAULT_FLOOD_SCENARIOS, '1937-historic').historicalDate).toBe('1937');
  });

  it('produces a bounded solar elevation and normalized direction', () => {
    const position = calculateSolarPosition({
      date: new Date('2026-08-22T17:00:00Z'),
      latitudeDegrees: 37.8922,
      longitudeDegrees: -88.0125,
      timezoneOffsetMinutes: -300,
    });
    expect(position.elevationDegrees).toBeGreaterThan(-90);
    expect(position.elevationDegrees).toBeLessThanOrEqual(90);
    const length = Math.hypot(...position.sunDirection);
    expect(length).toBeCloseTo(1, 6);
  });

  it('provides distinct renderable light and sky values for every cinematic preset', () => {
    const presets = (['day', 'golden', 'night'] as const).map((preset) => getCinematicLighting(preset));
    expect(new Set(presets.map(({ light }) => light.color)).size).toBe(3);
    expect(new Set(presets.map(({ light }) => light.intensity)).size).toBe(3);
    expect(new Set(presets.map(({ sky }) => sky['sky-color'])).size).toBe(3);
    for (const { light, sky } of presets) {
      expect(light.position).toHaveLength(3);
      expect(sky['horizon-color']).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
