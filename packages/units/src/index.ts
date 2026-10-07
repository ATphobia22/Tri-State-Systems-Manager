export type LengthUnit = "m" | "km" | "ft" | "mi";
export type AreaUnit = "m2" | "km2" | "ft2" | "acre";
export type TempUnit = "c" | "f" | "k";

const LENGTH_TO_M: Record<LengthUnit, number> = { m: 1, km: 1000, ft: 0.3048, mi: 1609.344 };
const AREA_TO_M2: Record<AreaUnit, number> = {
  m2: 1,
  km2: 1_000_000,
  ft2: 0.092903,
  acre: 4046.8564224,
};

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  return (value * LENGTH_TO_M[from]) / LENGTH_TO_M[to];
}

export function convertArea(value: number, from: AreaUnit, to: AreaUnit): number {
  return (value * AREA_TO_M2[from]) / AREA_TO_M2[to];
}

export function convertTemperature(value: number, from: TempUnit, to: TempUnit): number {
  const celsius = from === "c" ? value : from === "f" ? ((value - 32) * 5) / 9 : value - 273.15;
  if (to === "c") return celsius;
  if (to === "f") return (celsius * 9) / 5 + 32;
  return celsius + 273.15;
}

export function formatLength(meters: number, unit: LengthUnit = "m", digits = 2): string {
  return `${convertLength(meters, "m", unit).toFixed(digits)} ${unit}`;
}
