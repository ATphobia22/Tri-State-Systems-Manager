/** Fail-closed vertical-datum reconciliation contract. */
export type VerticalDatum = 'GAGE_DATUM' | 'NAVD88';

export interface DatumProvenanceToken {
  readonly tokenId: string;
  readonly authority: string;
  readonly sourceUri: string;
  readonly transformationId: string;
  readonly issuedAt: string;
  readonly sha256: string;
}

export interface DatumObservation {
  readonly value: number;
  readonly unit: 'ft' | 'm';
  readonly datum: VerticalDatum;
  readonly observedAt: string;
  readonly stationId: string;
  readonly provenance: DatumProvenanceToken;
}

export interface DatumTransform {
  readonly transformationId: string;
  readonly from: VerticalDatum;
  readonly to: VerticalDatum;
  readonly offset: number;
  readonly unit: 'ft' | 'm';
  readonly provenance: DatumProvenanceToken;
}

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
}

function assertToken(token: DatumProvenanceToken, expectedId: string): void {
  if (!token?.tokenId || token.tokenId !== expectedId || !token.authority || !token.sourceUri.startsWith('https://') || !token.transformationId || !token.sha256) {
    throw new Error('authoritative datum provenance token is required');
  }
}

export function reconcileVerticalDatum(
  observation: DatumObservation,
  transform: DatumTransform | null,
): DatumObservation {
  assertFinite(observation.value, 'observation.value');
  if (!observation.stationId || !observation.observedAt) throw new TypeError('stationId and observedAt are required');
  if (observation.datum === 'NAVD88') return Object.freeze({ ...observation });

  if (!transform || transform.from !== observation.datum || transform.to !== 'NAVD88') {
    throw new Error('NAVD88 conversion blocked: explicit authoritative transformation is required');
  }
  assertFinite(transform.offset, 'transform.offset');
  assertToken(transform.provenance, transform.transformationId);

  if (transform.unit !== observation.unit) throw new Error('datum transform unit must match observation unit');

  return Object.freeze({
    ...observation,
    value: observation.value + transform.offset,
    datum: 'NAVD88',
    provenance: transform.provenance,
  });
}

export function requireSourceDatum(value: DatumObservation): DatumObservation {
  if (value.datum !== 'GAGE_DATUM') throw new Error('source gage observations must retain GAGE_DATUM until an explicit transform is applied');
  assertFinite(value.value, 'value');
  assertToken(value.provenance, value.provenance.transformationId);
  return value;
}
