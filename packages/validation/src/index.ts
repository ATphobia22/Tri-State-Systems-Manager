export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export type Validator<T> = (value: T, path?: string) => ValidationIssue[];

export function combine<T>(...validators: Array<Validator<T>>): Validator<T> {
  return (value: T, path = "$") => validators.flatMap((validate) => validate(value, path));
}

export function required(path = "$"): Validator<unknown> {
  return (value, at = path) =>
    value === undefined || value === null || value === ""
      ? [{ path: at, message: "Value is required", code: "REQUIRED" }]
      : [];
}

export function isString(path = "$"): Validator<unknown> {
  return (value, at = path) =>
    typeof value !== "string"
      ? [{ path: at, message: "Expected a string", code: "TYPE_STRING" }]
      : [];
}

export function isNumber(path = "$"): Validator<unknown> {
  return (value, at = path) =>
    typeof value !== "number" || Number.isNaN(value)
      ? [{ path: at, message: "Expected a number", code: "TYPE_NUMBER" }]
      : [];
}

export function inRange(min: number, max: number, path = "$"): Validator<unknown> {
  return (value, at = path) =>
    typeof value !== "number" || value < min || value > max
      ? [{ path: at, message: `Expected a number in [${min}, ${max}]`, code: "OUT_OF_RANGE" }]
      : [];
}

export function validate<T>(value: T, validator: Validator<T>): ValidationResult {
  const issues = validator(value);
  return { valid: issues.length === 0, issues };
}
