import type { SolarLightingState } from './scene-state';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export interface SolarPositionInput {
  date: Date;
  latitudeDegrees: number;
  longitudeDegrees: number;
  timezoneOffsetMinutes: number;
}

export interface SolarPosition {
  azimuthDegrees: number;
  elevationDegrees: number;
  sunDirection: [number, number, number];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

/** NOAA-style approximate solar position; suitable for visualization, not survey astronomy. */
export function calculateSolarPosition(input: SolarPositionInput): SolarPosition {
  if (!Number.isFinite(input.latitudeDegrees) || input.latitudeDegrees < -90 || input.latitudeDegrees > 90) {
    throw new RangeError('latitudeDegrees must be between -90 and 90');
  }
  if (!Number.isFinite(input.longitudeDegrees) || input.longitudeDegrees < -180 || input.longitudeDegrees > 180) {
    throw new RangeError('longitudeDegrees must be between -180 and 180');
  }
  if (!Number.isFinite(input.timezoneOffsetMinutes) || input.timezoneOffsetMinutes < -840 || input.timezoneOffsetMinutes > 840) {
    throw new RangeError('timezoneOffsetMinutes is outside the valid range');
  }

  const day = dayOfYear(input.date);
  const fractionalHourUtc = input.date.getUTCHours() + input.date.getUTCMinutes() / 60 + input.date.getUTCSeconds() / 3600;
  const localMinutes = fractionalHourUtc * 60 + input.timezoneOffsetMinutes;
  const localHour = localMinutes / 60;
  const gamma = (2 * Math.PI / 365) * (day - 1 + (localHour - 12) / 24);
  const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const solarTimeMinutes = localMinutes + equationOfTime + 4 * input.longitudeDegrees;
  const hourAngleDegrees = solarTimeMinutes / 4 - 180;
  const latitude = input.latitudeDegrees * DEG_TO_RAD;
  const hourAngle = hourAngleDegrees * DEG_TO_RAD;
  const sinElevation = Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const elevation = Math.asin(clamp(sinElevation, -1, 1));
  const cosAzimuth = clamp((Math.sin(declination) * Math.cos(latitude) - Math.cos(declination) * Math.sin(latitude) * Math.cos(hourAngle)) / Math.max(Math.cos(elevation), 1e-8), -1, 1);
  let azimuth = Math.acos(cosAzimuth);
  if (hourAngle > 0) azimuth = 2 * Math.PI - azimuth;

  const cosElevation = Math.max(Math.cos(elevation), 0);
  const azimuthFromNorth = azimuth;
  const sunDirection: [number, number, number] = [
    cosElevation * Math.sin(azimuthFromNorth),
    cosElevation * Math.cos(azimuthFromNorth),
    Math.sin(elevation),
  ];

  return {
    azimuthDegrees: azimuthFromNorth * RAD_TO_DEG,
    elevationDegrees: elevation * RAD_TO_DEG,
    sunDirection,
  };
}

export class TriStateSolarEngine {
  constructor(
    private readonly latitudeDegrees = 37.8922,
    private readonly longitudeDegrees = -88.0125,
    private readonly timezoneOffsetMinutes = -300,
  ) {}

  calculate(date: Date): SolarLightingState {
    const position = calculateSolarPosition({ date, latitudeDegrees: this.latitudeDegrees, longitudeDegrees: this.longitudeDegrees, timezoneOffsetMinutes: this.timezoneOffsetMinutes });
    return {
      simulationTime: date.toISOString(),
      latitudeDegrees: this.latitudeDegrees,
      longitudeDegrees: this.longitudeDegrees,
      timezoneOffsetMinutes: this.timezoneOffsetMinutes,
      ...position,
      ambientIntensity: position.elevationDegrees < 0 ? 0.08 : 0.18,
    };
  }
}
