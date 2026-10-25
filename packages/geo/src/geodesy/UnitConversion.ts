import { LINEAR_UNITS, type LinearUnit } from "./UnitRegistry.js";
export function convertLinear(value: number, from: LinearUnit, to: LinearUnit): number {
  if (!Number.isFinite(value)) throw new TypeError("UNIT_VALUE_MUST_BE_FINITE");
  const source = LINEAR_UNITS.get(from);
  const target = LINEAR_UNITS.get(to);
  if (!source || !target) throw new RangeError("UNSUPPORTED_LINEAR_UNIT");
  const result = value * source.metersPerUnit / target.metersPerUnit;
  if (!Number.isFinite(result)) throw new RangeError("UNIT_CONVERSION_OVERFLOW");
  return result;
}
