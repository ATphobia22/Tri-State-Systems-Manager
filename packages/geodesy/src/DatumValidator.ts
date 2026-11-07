export interface DatumValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateDatum(
  horizontalDatum?: string,
  verticalDatum?: string,
  options: { requireVertical?: boolean } = {},
): DatumValidation {
  const errors: string[] = [];
  if (!horizontalDatum) errors.push('missing horizontal datum');
  if (options.requireVertical && !verticalDatum) errors.push('missing vertical datum');
  return { valid: errors.length === 0, errors };
}
