/**
 * Technical release gates for a HEC-RAS screening run.
 *
 * This module validates supplied evidence contracts. It does not fetch or
 * authenticate PE registry records, verify an agency determination, or run
 * HEC-RAS itself. Missing evidence is reported as unavailable; contradictory
 * evidence is reported as blocked. Neither state fabricates an accepted run.
 */

export type GateState = 'passed' | 'unavailable' | 'blocked';

export interface GateResult {
  id: 'aoi-boundary' | 'dem-provenance' | 'vertical-datum' | 'solver-hash' | 'pe-signoff';
  state: GateState;
  summary: string;
  findings: string[];
}

export interface AoiBoundaryEvidence {
  aoiId: string;
  watershedId: string;
  boundaryGeoJson: string;
  boundarySha256: string;
  crs: string;
  areaSqKm: number;
  sourceUri: string;
  topologyValidation: 'passed' | 'failed' | 'not-run';
  intersectsWatershed: boolean | null;
}

export interface DemProvenanceEvidence {
  sourceName: string;
  sourceUri: string;
  acquisitionDate: string;
  resolutionM: number;
  horizontalCrs: string;
  verticalDatum: string;
  verticalUnits: 'm' | 'ft';
  rasterSha256: string;
  /** Original raster bytes from the acquisition/validation pipeline. */
  rasterBytes: Uint8Array | null;
}

export interface VerticalDatumEvidence {
  sourceVerticalDatum: string;
  targetVerticalDatum: string;
  transformationModel: string;
  transformationApplied: boolean;
  evidenceUri: string;
}

export interface SolverEvidence {
  solverName: string;
  solverVersion: string;
  inputManifest: string;
  inputSha256: string;
  outputArtifact: string;
  outputSha256: string;
}

export interface PeSignoffEvidence {
  peName: string;
  peLicenseNumber: string;
  jurisdiction: string;
  discipline: string;
  signedAt: string;
  signedArtifactSha256: string;
  licenseRegistryStatus: 'verified' | 'unverified' | 'invalid';
  verificationEvidenceUri: string | null;
}

export interface HecReleaseGateInput {
  aoi: AoiBoundaryEvidence | null;
  dem: DemProvenanceEvidence | null;
  verticalDatum: VerticalDatumEvidence | null;
  solver: SolverEvidence | null;
  peSignoff: PeSignoffEvidence | null;
}

export interface HecReleaseGateReport {
  schema: 'tsm.hec-release-gates.v1';
  status: 'ready-for-engineering-review' | 'incomplete' | 'blocked';
  gates: GateResult[];
  passed: number;
  unavailable: number;
  blocked: number;
  note: string;
}

const SHA256 = /^[a-f0-9]{64}$/i;
const HTTPS_URI = /^https:\/\//i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function gate(
  id: GateResult['id'],
  findings: string[],
  successSummary: string,
): GateResult {
  if (findings.some((finding) => finding.startsWith('BLOCKED:'))) {
    return { id, state: 'blocked', summary: 'Evidence conflicts with the technical contract.', findings };
  }
  if (findings.length > 0) {
    return { id, state: 'unavailable', summary: 'Required evidence is missing or incomplete.', findings };
  }
  return { id, state: 'passed', summary: successSummary, findings: [] };
}

function requiredString(value: unknown, label: string, findings: string[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) findings.push(`Missing ${label}.`);
}

function validHttps(value: string, label: string, findings: string[]): void {
  if (!HTTPS_URI.test(value)) findings.push(`Missing valid HTTPS ${label}.`);
}

function validHash(value: string, label: string, findings: string[]): void {
  if (!SHA256.test(value)) findings.push(`Missing valid SHA-256 ${label}.`);
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function checkAoi(input: AoiBoundaryEvidence | null): Promise<GateResult> {
  if (!input) return gate('aoi-boundary', ['AOI boundary evidence was not supplied.'], '');
  const findings: string[] = [];
  requiredString(input.aoiId, 'AOI identifier', findings);
  requiredString(input.watershedId, 'watershed identifier', findings);
  requiredString(input.crs, 'boundary CRS', findings);
  requiredString(input.boundaryGeoJson, 'boundary GeoJSON', findings);
  validHttps(input.sourceUri, 'boundary source URI', findings);
  validHash(input.boundarySha256, 'boundary checksum', findings);
  if (!Number.isFinite(input.areaSqKm) || input.areaSqKm <= 0) findings.push('BLOCKED: AOI area must be finite and positive.');
  if (input.topologyValidation === 'failed') findings.push('BLOCKED: AOI boundary topology validation failed.');
  else if (input.topologyValidation !== 'passed') findings.push('Boundary topology validation has not run.');
  if (input.intersectsWatershed === false) findings.push('BLOCKED: AOI does not intersect the declared watershed.');
  else if (input.intersectsWatershed !== true) findings.push('AOI-to-watershed intersection result is missing.');
  if (input.boundaryGeoJson && SHA256.test(input.boundarySha256)) {
    const actual = await sha256Hex(input.boundaryGeoJson);
    if (actual.toLowerCase() !== input.boundarySha256.toLowerCase()) findings.push('BLOCKED: boundary SHA-256 does not match the supplied GeoJSON text.');
  }
  return gate('aoi-boundary', findings, 'AOI boundary checksum and supplied topology/intersection evidence passed.');
}

async function checkDem(input: DemProvenanceEvidence | null): Promise<GateResult> {
  if (!input) return gate('dem-provenance', ['DEM provenance evidence was not supplied.'], '');
  const findings: string[] = [];
  requiredString(input.sourceName, 'DEM source name', findings);
  validHttps(input.sourceUri, 'DEM source URI', findings);
  if (!DATE_ONLY.test(input.acquisitionDate) || !Number.isFinite(Date.parse(input.acquisitionDate))) findings.push('Missing or invalid DEM acquisition date (YYYY-MM-DD).');
  if (!Number.isFinite(input.resolutionM) || input.resolutionM <= 0) findings.push('BLOCKED: DEM resolution must be finite and positive.');
  requiredString(input.horizontalCrs, 'DEM horizontal CRS', findings);
  if (input.verticalDatum !== 'NAVD88') findings.push(`BLOCKED: DEM vertical datum must be NAVD88; received ${input.verticalDatum || 'missing'}.`);
  if (input.verticalUnits !== 'm' && input.verticalUnits !== 'ft') findings.push('Missing or unsupported DEM vertical units.');
  validHash(input.rasterSha256, 'DEM raster checksum', findings);
  if (!input.rasterBytes || input.rasterBytes.byteLength === 0) {
    findings.push('DEM raster bytes were not supplied; checksum cannot be independently verified.');
  } else if (SHA256.test(input.rasterSha256)) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', input.rasterBytes);
    const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (actual.toLowerCase() !== input.rasterSha256.toLowerCase()) findings.push('BLOCKED: DEM raster SHA-256 does not match the supplied raster bytes.');
  }
  return gate('dem-provenance', findings, 'DEM source, acquisition, resolution, CRS, vertical datum, units, and raster-byte SHA-256 verification passed.');
}

function checkVerticalDatum(input: VerticalDatumEvidence | null): GateResult {
  if (!input) return gate('vertical-datum', ['Vertical-datum evidence was not supplied.'], '');
  const findings: string[] = [];
  if (input.targetVerticalDatum !== 'NAVD88') findings.push(`BLOCKED: target vertical datum must be NAVD88; received ${input.targetVerticalDatum || 'missing'}.`);
  requiredString(input.sourceVerticalDatum, 'source vertical datum', findings);
  requiredString(input.transformationModel, 'transformation model', findings);
  validHttps(input.evidenceUri, 'datum evidence URI', findings);
  if (input.sourceVerticalDatum !== 'NAVD88' && !input.transformationApplied) findings.push('BLOCKED: source datum differs from NAVD88 but no transformation is declared.');
  if (input.sourceVerticalDatum !== 'NAVD88' && input.transformationApplied && !input.transformationModel.trim()) findings.push('BLOCKED: transformed heights require a named transformation model.');
  return gate('vertical-datum', findings, 'Vertical datum and any declared transformation are internally consistent.');
}

async function checkSolver(input: SolverEvidence | null): Promise<GateResult> {
  if (!input) return gate('solver-hash', ['Solver execution evidence was not supplied.'], '');
  const findings: string[] = [];
  requiredString(input.solverName, 'solver name', findings);
  requiredString(input.solverVersion, 'solver version', findings);
  requiredString(input.inputManifest, 'solver input manifest', findings);
  requiredString(input.outputArtifact, 'solver output artifact', findings);
  validHash(input.inputSha256, 'solver input checksum', findings);
  validHash(input.outputSha256, 'solver output checksum', findings);
  if (input.inputManifest && SHA256.test(input.inputSha256)) {
    const actual = await sha256Hex(input.inputManifest);
    if (actual.toLowerCase() !== input.inputSha256.toLowerCase()) findings.push('BLOCKED: solver input SHA-256 does not match the supplied manifest text.');
  }
  if (input.outputArtifact && SHA256.test(input.outputSha256)) {
    const actual = await sha256Hex(input.outputArtifact);
    if (actual.toLowerCase() !== input.outputSha256.toLowerCase()) findings.push('BLOCKED: solver output SHA-256 does not match the supplied artifact text.');
  }
  return gate('solver-hash', findings, 'Solver identity and input/output SHA-256 checks passed.');
}

function checkPeSignoff(input: PeSignoffEvidence | null, solver: SolverEvidence | null): GateResult {
  if (!input) return gate('pe-signoff', ['PE sign-off evidence was not supplied.'], '');
  const findings: string[] = [];
  requiredString(input.peName, 'PE name', findings);
  requiredString(input.peLicenseNumber, 'PE license number', findings);
  requiredString(input.jurisdiction, 'PE licensing jurisdiction', findings);
  requiredString(input.discipline, 'PE discipline', findings);
  if (!input.signedAt || !Number.isFinite(Date.parse(input.signedAt))) findings.push('Missing or invalid PE sign-off timestamp.');
  validHash(input.signedArtifactSha256, 'PE-signed artifact checksum', findings);
  if (input.licenseRegistryStatus === 'invalid') findings.push('BLOCKED: supplied license verification marks the PE license invalid.');
  else if (input.licenseRegistryStatus !== 'verified') findings.push('PE license has not been verified against the issuing jurisdiction registry.');
  if (input.licenseRegistryStatus === 'verified') validHttps(input.verificationEvidenceUri ?? '', 'license verification evidence URI', findings);
  if (solver && SHA256.test(solver.outputSha256) && SHA256.test(input.signedArtifactSha256)
      && solver.outputSha256.toLowerCase() !== input.signedArtifactSha256.toLowerCase()) {
    findings.push('BLOCKED: PE sign-off hash does not match the solver output hash.');
  }
  return gate('pe-signoff', findings, 'PE sign-off metadata and external license-verification evidence are present.');
}

export class HECReleaseGateChecker {
  static async check(input: HecReleaseGateInput): Promise<HecReleaseGateReport> {
    const gates = [
      await checkAoi(input.aoi),
      await checkDem(input.dem),
      checkVerticalDatum(input.verticalDatum),
      await checkSolver(input.solver),
      checkPeSignoff(input.peSignoff, input.solver),
    ];
    const passed = gates.filter((item) => item.state === 'passed').length;
    const unavailable = gates.filter((item) => item.state === 'unavailable').length;
    const blocked = gates.filter((item) => item.state === 'blocked').length;
    return {
      schema: 'tsm.hec-release-gates.v1',
      status: blocked > 0 ? 'blocked' : unavailable > 0 ? 'incomplete' : 'ready-for-engineering-review',
      gates,
      passed,
      unavailable,
      blocked,
      note: 'Ready-for-engineering-review is a technical evidence result, not a HEC-RAS execution, PE license registry attestation, agency approval, or regulatory determination.',
    };
  }
}
