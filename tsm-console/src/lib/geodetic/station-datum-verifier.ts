/**
 * Station-specific datum evidence contract.
 *
 * This verifier checks evidence consistency and cryptographic integrity; it
 * does not fetch source documents or assert that an agency publication is
 * authentic. An external acquisition/registry step must supply the evidence.
 */

export type StationDatumState = 'verified' | 'unavailable' | 'invalid';

export interface StationDatumEvidence {
  stationId: string;
  sourceStationId: string;
  agency: 'USGS' | 'NOAA_NWS' | 'USACE';
  productId: string;
  parameterCode: string;
  gageZeroNavd88Ft: number;
  verticalDatum: string;
  unit: string;
  sourceUri: string;
  sourceDocumentText: string;
  sourceDocumentSha256: string;
  verifiedAt: string;
  sourceProductRelationshipConfirmed: boolean;
}

export interface StationDatumVerification {
  stationId: string;
  state: StationDatumState;
  gageZeroNavd88Ft: number | null;
  verticalDatum: 'NAVD88' | null;
  sourceUri: string | null;
  sourceDocumentSha256: string | null;
  findings: string[];
  note: string;
}

const SHA256 = /^[a-f0-9]{64}$/i;

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class StationDatumVerifier {
  static async verify(evidence: StationDatumEvidence | null, expectedStationId: string): Promise<StationDatumVerification> {
    const base = {
      stationId: expectedStationId,
      gageZeroNavd88Ft: null,
      verticalDatum: null,
      sourceUri: null,
      sourceDocumentSha256: null,
    } as const;
    if (!evidence) {
      return { ...base, state: 'unavailable', findings: ['Station datum evidence was not supplied.'], note: 'Keep telemetry in source gage datum; do not derive NAVD88 WSE.' };
    }
    const findings: string[] = [];
    if (!expectedStationId.trim()) findings.push('Expected station ID is missing.');
    if (evidence.stationId !== expectedStationId || evidence.sourceStationId !== expectedStationId) findings.push('Station identifier does not match the requested station and source document.');
    if (!evidence.productId.trim() || !evidence.parameterCode.trim()) findings.push('Source product and parameter identifiers are required.');
    if (!/^https:\/\//i.test(evidence.sourceUri)) findings.push('Source URI must use HTTPS.');
    if (evidence.verticalDatum !== 'NAVD88') findings.push('Gage-zero relationship must explicitly target NAVD88.');
    if (evidence.unit !== 'ft') findings.push('Gage-zero relationship must be expressed in feet.');
    if (!Number.isFinite(evidence.gageZeroNavd88Ft)) findings.push('Gage-zero elevation must be finite.');
    if (!evidence.verifiedAt || !Number.isFinite(Date.parse(evidence.verifiedAt))) findings.push('Evidence verification timestamp is missing or invalid.');
    if (!evidence.sourceProductRelationshipConfirmed) findings.push('Station/product relationship has not been confirmed; NAVD88 conversion remains unavailable.');
    if (!SHA256.test(evidence.sourceDocumentSha256)) findings.push('Source-document SHA-256 is missing or malformed.');
    else if (evidence.sourceDocumentText) {
      const actual = await sha256Hex(evidence.sourceDocumentText);
      if (actual.toLowerCase() !== evidence.sourceDocumentSha256.toLowerCase()) findings.push('Source-document SHA-256 does not match supplied document text.');
    } else findings.push('Source-document text was not supplied for checksum verification.');
    if (findings.length > 0) {
      const invalid = findings.some((finding) => /does not match|must explicitly|must use|must be finite|malformed|not confirmed|not match/.test(finding));
      return {
        ...base,
        state: invalid ? 'invalid' : 'unavailable',
        findings,
        note: 'No NAVD88 conversion is emitted until station identity, product semantics, datum, units, and source-document integrity are consistent.',
      };
    }
    return {
      stationId: expectedStationId,
      state: 'verified',
      gageZeroNavd88Ft: evidence.gageZeroNavd88Ft,
      verticalDatum: 'NAVD88',
      sourceUri: evidence.sourceUri,
      sourceDocumentSha256: evidence.sourceDocumentSha256.toLowerCase(),
      findings: [],
      note: 'Evidence contract passed; source authenticity still depends on the upstream source-acquisition and review process.',
    };
  }
}
