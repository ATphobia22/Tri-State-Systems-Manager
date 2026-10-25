export type LinearUnit = "m" | "km" | "ft" | "ftUS" | "mi";
export interface UnitDefinition { symbol: LinearUnit; name: string; metersPerUnit: number; }
export const LINEAR_UNITS: ReadonlyMap<LinearUnit, UnitDefinition> = new Map([
  ["m", { symbol: "m", name: "metre", metersPerUnit: 1 }],
  ["km", { symbol: "km", name: "kilometre", metersPerUnit: 1000 }],
  ["ft", { symbol: "ft", name: "international foot", metersPerUnit: 0.3048 }],
  ["ftUS", { symbol: "ftUS", name: "U.S. survey foot", metersPerUnit: 1200 / 3937 }],
  ["mi", { symbol: "mi", name: "international mile", metersPerUnit: 1609.344 }]
]);
