/**
 * FEMA LOMA / MT-1 evidence gate.
 *
 * This module models document/evidence completeness only. It never certifies
 * elevations, signs forms, issues a LOMA, or makes a FEMA determination.
 *
 * Source basis:
 * - FEMA case 26-05-2022A (September 22, 2026) supplied to TSM.
 * - FEMA MT-1 technical/application guidance.
 */
export type LomaEvidenceStatus =
  | 'PASS'
  | 'MISSING'
  | 'INVALID'
  | 'REQUIRES_HUMAN_CERTIFICATION'
  | 'NOT_APPLICABLE'
  | 'UNVERIFIED';

export type LomaSubmissionStatus =
  | 'BLOCKED'
  | 'READY_FOR_HUMAN_REVIEW'
  | 'READY_FOR_SUBMISSION';

export type LomaEvidenceKind =
  | 'RECORDED_DEED'
  | 'RECORDED_SUBDIVISION_PLAT'
  | 'TAX_ASSESSOR_MAP'
  | 'MT1_FORM_2'
  | 'ELEVATION_CERTIFICATE'
  | 'FIRM_MAP'
  | 'FIRMETTE'
  | 'FIS'
  | 'FARA'
  | 'EFARA'
  | 'COMMUNITY_ACKNOWLEDGMENT'
  | 'OTHER';

export interface LomaEvidenceItem {
  kind: LomaEvidenceKind;
  status: LomaEvidenceStatus;
  artifactId?: string;
  contentHashSha256?: string;
  notes?: string;
}

export interface Mt1ElevationInputs {
  condition: 'EXISTING' | 'PROPOSED' | null;
  constructionTypes: Array<'CRAWL_SPACE' | 'SLAB_ON_GRADE' | 'BASEMENT_ENCLOSURE' | 'OTHER'>;
  subsidenceOrUplift: 'YES' | 'NO' | null;
  relevelingMonthYear?: string;
  verticalDatum: 'NGVD29' | 'NAVD88' | 'OTHER' | null;
  datumConversionFt?: number;
  structureLatitude?: number;
  structureLongitude?: number;
  structureCoordinateDatum?: 'WGS84' | 'NAD83' | 'NAD27';
  propertyLatitude?: number;
  propertyLongitude?: number;
  propertyCoordinateDatum?: 'WGS84' | 'NAD83' | 'NAD27';
  lowestLotElevationFt?: number;
  lowestAdjacentGradeFt?: number;
  bfeFt?: number;
  bfeSource?: string;
}

export interface ProfessionalCertification {
  certifierName?: string;
  licenseNumber?: string;
  expirationDate?: string;
  companyName?: string;
  signaturePresent: boolean;
  certificationDate?: string;
  certificationArtifactId?: string;
}

export interface LomaEvidenceInput {
  caseId?: string;
  firmClearlyOutsideSfha: boolean | null;
  deedOrPlat: LomaEvidenceItem[];
  assessorMap?: LomaEvidenceItem;
  elevationForm?: LomaEvidenceItem;
  elevationCertificate?: LomaEvidenceItem;
  firmEvidence?: LomaEvidenceItem;
  professionalCertification?: ProfessionalCertification;
  mt1?: Mt1ElevationInputs;
}

export interface LomaGate {
  id: string;
  label: string;
  status: LomaEvidenceStatus;
  required: boolean;
  reason: string;
}

export interface LomaAuditResult {
  gates: LomaGate[];
  submissionStatus: LomaSubmissionStatus;
  missingRequired: string[];
  humanCertificationRequired: boolean;
}

const SHA256 = /^[a-f0-9]{64}$/;

function hasUsableArtifact(item: LomaEvidenceItem | undefined): boolean {
  return !!item &&
    item.status === 'PASS' &&
    !!item.artifactId &&
    !!item.contentHashSha256 &&
    SHA256.test(item.contentHashSha256);
}

function hasRecordedDeedOrPlat(items: LomaEvidenceItem[]): boolean {
  return items.some(hasUsableArtifact);
}

function validCoordinate(value: number | undefined): boolean {
  return value !== undefined && Number.isFinite(value);
}

function validTenthFoot(value: number | undefined): boolean {
  return value !== undefined && Number.isFinite(value) &&
    Math.round(value * 10) === value * 10;
}

function auditMt1(input: LomaEvidenceInput): LomaGate[] {
  const mt1 = input.mt1;
  const cert = input.professionalCertification;
  const elevationEvidencePresent =
    hasUsableArtifact(input.elevationForm) ||
    hasUsableArtifact(input.elevationCertificate);

  if (input.firmClearlyOutsideSfha === true && !elevationEvidencePresent) {
    return [{
      id: 'MT1-ELEVATION',
      label: 'MT-1 Form 2 / qualifying Elevation Certificate',
      status: 'NOT_APPLICABLE',
      required: false,
      reason: 'The supplied FEMA case correspondence permits omission when the FIRM clearly shows the property/structure outside the SFHA.',
    }];
  }

  const gates: LomaGate[] = [{
    id: 'MT1-ELEVATION',
    label: 'MT-1 Form 2 or qualifying Elevation Certificate',
    status: elevationEvidencePresent ? 'PASS' : 'MISSING',
    required: true,
    reason: 'FEMA case correspondence requires elevation evidence unless the FIRM clearly establishes the property/structure outside the SFHA.',
  }];

  if (!elevationEvidencePresent) return gates;

  const complete =
    !!mt1 &&
    mt1.condition !== null &&
    mt1.constructionTypes.length > 0 &&
    mt1.subsidenceOrUplift !== null &&
    mt1.verticalDatum !== null &&
    validCoordinate(mt1.structureLatitude) &&
    validCoordinate(mt1.structureLongitude) &&
    validCoordinate(mt1.propertyLatitude) &&
    validCoordinate(mt1.propertyLongitude) &&
    validTenthFoot(mt1.lowestLotElevationFt) &&
    validTenthFoot(mt1.lowestAdjacentGradeFt) &&
    validTenthFoot(mt1.bfeFt) &&
    !!mt1.bfeSource;

  gates.push({
    id: 'MT1-FIELDS',
    label: 'MT-1 elevation/data fields',
    status: complete ? 'PASS' : 'INVALID',
    required: true,
    reason: 'MT-1 requires condition, construction, datum, coordinates, elevation values and BFE source; elevation values are recorded to the nearest tenth of a foot.',
  });

  const certified =
    !!cert &&
    cert.signaturePresent &&
    !!cert.certifierName &&
    !!cert.licenseNumber &&
    !!cert.expirationDate &&
    !!cert.certificationDate;

  gates.push({
    id: 'MT1-CERTIFICATION',
    label: 'Professional elevation certification',
    status: certified ? 'PASS' : 'REQUIRES_HUMAN_CERTIFICATION',
    required: true,
    reason: 'TSM may check certification metadata but cannot create or substitute for the licensed professional certification.',
  });

  return gates;
}

export function auditFemaLomaEvidence(input: LomaEvidenceInput): LomaAuditResult {
  const gates: LomaGate[] = [
    {
      id: 'CASE',
      label: 'FEMA case identifier',
      status: input.caseId ? 'PASS' : 'MISSING',
      required: true,
      reason: 'Case correspondence instructs the requester to include the case number with subsequent correspondence.',
    },
    {
      id: 'DEED_OR_PLAT',
      label: 'Recorded deed or subdivision plat',
      status: hasRecordedDeedOrPlat(input.deedOrPlat) ? 'PASS' : 'MISSING',
      required: true,
      reason: 'FEMA case 26-05-2022A specifically requested a recorded deed OR recorded subdivision plat with recordation data/stamp.',
    },
    {
      id: 'ASSESSOR_MAP',
      label: 'Local tax assessor map',
      status: hasUsableArtifact(input.assessorMap) ? 'PASS' : 'MISSING',
      required: true,
      reason: 'The map must clearly identify the property and include a street intersection shown on the applicable FIRM panel.',
    },
    {
      id: 'FIRM_EVIDENCE',
      label: 'Effective FIRM/FIS evidence',
      status: hasUsableArtifact(input.firmEvidence) ? 'PASS' : 'MISSING',
      required: true,
      reason: 'TSM must preserve the effective regulatory source rather than replacing it with model output.',
    },
    ...auditMt1(input),
  ];

  const missingRequired = gates
    .filter((gate) => gate.required && gate.status !== 'PASS')
    .map((gate) => gate.label);

  const humanCertificationRequired = gates.some(
    (gate) => gate.status === 'REQUIRES_HUMAN_CERTIFICATION',
  );

  const submissionStatus: LomaSubmissionStatus =
    missingRequired.length > 0
      ? 'BLOCKED'
      : humanCertificationRequired
        ? 'READY_FOR_HUMAN_REVIEW'
        : 'READY_FOR_SUBMISSION';

  return {
    gates,
    submissionStatus,
    missingRequired,
    humanCertificationRequired,
  };
}
