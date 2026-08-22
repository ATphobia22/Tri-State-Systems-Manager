export interface SolarState {
  utcTime: string;
  latitudeDegrees: number;
  longitudeDegrees: number;
  solarAzimuthDegrees: number;
  solarElevationDegrees: number;
  sunDirection: readonly [number, number, number];
  isDaylight: boolean;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

/** Deterministic NOAA-style solar-position approximation. UTC avoids local-time ambiguity. */
export function calculateSolarState(
  utcTime: Date,
  latitudeDegrees: number,
  longitudeDegrees: number,
): SolarState {
  if (!Number.isFinite(latitudeDegrees) || latitudeDegrees < -90 || latitudeDegrees > 90) {
    throw new RangeError("latitudeDegrees must be within [-90, 90]");
  }
  if (!Number.isFinite(longitudeDegrees) || longitudeDegrees < -180 || longitudeDegrees > 180) {
    throw new RangeError("longitudeDegrees must be within [-180, 180]");
  }
  if (Number.isNaN(utcTime.getTime())) {
    throw new RangeError("utcTime must be a valid Date");
  }

  const n = dayOfYear(utcTime);
  const hour = utcTime.getUTCHours() + utcTime.getUTCMinutes() / 60 + utcTime.getUTCSeconds() / 3600;
  const gamma = (2 * Math.PI / 365) * (n - 1 + (hour - 12) / 24);

  const equationOfTime = 229.18 * (
    0.000075 +
    0.001868 * Math.cos(gamma) -
    0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) -
    0.040849 * Math.sin(2 * gamma)
  );
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const trueSolarMinutes = hour * 60 + equationOfTime + 4 * longitudeDegrees;
  const hourAngle = (trueSolarMinutes / 4 - 180) * DEG_TO_RAD;
  const latitude = latitudeDegrees * DEG_TO_RAD;

  const sinElevation =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  const elevation = Math.asin(clamp(sinElevation, -1, 1));

  const azimuthRadians = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(declination) * Math.cos(latitude),
  );
  const azimuthDegrees = (azimuthRadians * RAD_TO_DEG + 180 + 360) % 360;
  const elevationDegrees = elevation * RAD_TO_DEG;
  const azimuth = azimuthDegrees * DEG_TO_RAD;

  // ENU convention: x=east, y=north, z=up. Convert once at the renderer boundary if needed.
  const sunDirection: readonly [number, number, number] = [
    Math.cos(elevation) * Math.sin(azimuth),
    Math.cos(elevation) * Math.cos(azimuth),
    Math.sin(elevation),
  ];

  return {
    utcTime: utcTime.toISOString(),
    latitudeDegrees,
    longitudeDegrees,
    solarAzimuthDegrees: azimuthDegrees,
    solarElevationDegrees: elevationDegrees,
    sunDirection,
    isDaylight: elevationDegrees > 0,
  };
}

export function simulationHourToUtcDate(
  year: number,
  month: number,
  day: number,
  hourUtc: number,
): Date {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new RangeError("year, month, and day must be integers");
  }
  if (!Number.isFinite(hourUtc) || hourUtc < 0 || hourUtc >= 24) {
    throw new RangeError("hourUtc must be in [0, 24)");
  }
  const wholeHours = Math.floor(hourUtc);
  const minutes = Math.floor((hourUtc - wholeHours) * 60);
  const seconds = Math.round((((hourUtc - wholeHours) * 60) - minutes) * 60);
  return new Date(Date.UTC(year, month - 1, day, wholeHours, minutes, seconds));
}
