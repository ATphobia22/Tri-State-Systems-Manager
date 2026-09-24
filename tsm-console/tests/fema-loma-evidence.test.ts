import { describe, expect, it } from 'vitest';
import { auditFemaLomaEvidence, type LomaEvidenceItem } from '../src/lib/fema-loma-evidence';

const hash = 'a'.repeat(64);
const evidence = (kind: LomaEvidenceItem['kind']): LomaEvidenceItem => ({
  kind,
  status: 'PASS',
  artifactId: `artifact-${kind}`,
  contentHashSha256: hash,
});

describe('FEMA LOMA evidence gate', () => {
  it('blocks a Case 26-05-2022A-style incomplete submission', () => {
    const result = auditFemaLomaEvidence({
      caseId: '26-05-2022A',
      firmClearlyOutsideSfha: false,
      deedOrPlat: [],
    });

    expect(result.submissionStatus).toBe('BLOCKED');
    expect(result.missingRequired).toEqual(expect.arrayContaining([
      'Recorded deed or subdivision plat',
      'Local tax assessor map',
      'Effective FIRM/FIS evidence',
      'MT-1 Form 2 or qualifying Elevation Certificate',
    ]));
  });

  it('accepts the FIRM-outside-SFHA exception for elevation evidence but still requires documentary gates', () => {
    const result = auditFemaLomaEvidence({
      caseId: '26-05-2022A',
      firmClearlyOutsideSfha: true,
      deedOrPlat: [evidence('RECORDED_DEED')],
      assessorMap: evidence('TAX_ASSESSOR_MAP'),
      firmEvidence: evidence('FIRM_MAP'),
    });

    expect(result.gates.find((gate) => gate.id === 'MT1-ELEVATION')?.status).toBe('NOT_APPLICABLE');
    expect(result.submissionStatus).toBe('READY_FOR_HUMAN_REVIEW');
  });

  it('blocks fill from being silently treated as a pure LOMA', () => {
    const result = auditFemaLomaEvidence({
      caseId: '26-05-2022A',
      firmClearlyOutsideSfha: false,
      fillPlacedOrProposed: true,
      deedOrPlat: [evidence('RECORDED_DEED')],
      assessorMap: evidence('TAX_ASSESSOR_MAP'),
      firmEvidence: evidence('FIRM_MAP'),
    });

    expect(result.submissionStatus).toBe('BLOCKED');
    expect(result.missingRequired).toContain('LOMA pathway (no fill placed/proposed)');
  });

  it('requires the community acknowledgment gate when a LOMA request is in the regulatory floodway', () => {
    const result = auditFemaLomaEvidence({
      caseId: '26-05-2022A',
      firmClearlyOutsideSfha: false,
      propertyInRegulatoryFloodway: true,
      deedOrPlat: [evidence('RECORDED_DEED')],
      assessorMap: evidence('TAX_ASSESSOR_MAP'),
      firmEvidence: evidence('FIRM_MAP'),
    });

    expect(result.submissionStatus).toBe('BLOCKED');
    expect(result.missingRequired).toContain('Community Acknowledgment — Part B (floodway), when applicable');
  });

  it('accepts a supplied community acknowledgment for a floodway case', () => {
    const result = auditFemaLomaEvidence({
      caseId: '26-05-2022A',
      firmClearlyOutsideSfha: false,
      propertyInRegulatoryFloodway: true,
      deedOrPlat: [evidence('RECORDED_DEED')],
      assessorMap: evidence('TAX_ASSESSOR_MAP'),
      communityAcknowledgment: evidence('COMMUNITY_ACKNOWLEDGMENT'),
      firmEvidence: evidence('FIRM_MAP'),
    });

    expect(result.gates.find((gate) => gate.id === 'COMMUNITY_ACKNOWLEDGMENT')?.status).toBe('PASS');
    expect(result.missingRequired).not.toContain('Community Acknowledgment — Part B (floodway), when applicable');
  });


  it('accepts a qualifying Elevation Certificate in lieu of MT-1 Form 2', () => {
    const result = auditFemaLomaEvidence({
      caseId: '26-05-2022A',
      firmClearlyOutsideSfha: false,
      deedOrPlat: [evidence('RECORDED_DEED')],
      assessorMap: evidence('TAX_ASSESSOR_MAP'),
      firmEvidence: evidence('FIRM_MAP'),
      elevationCertificate: evidence('ELEVATION_CERTIFICATE'),
      professionalCertification: {
        certifierName: 'Licensed Surveyor',
        licenseNumber: 'LS-12345',
        expirationDate: '2027-12-31',
        signaturePresent: true,
        certificationDate: '2026-09-24',
      },
    });

    expect(result.gates.find((gate) => gate.id === 'MT1-ELEVATION')?.status).toBe('PASS');
    expect(result.gates.find((gate) => gate.id === 'MT1-FIELDS')?.status).toBe('NOT_APPLICABLE');
    expect(result.submissionStatus).toBe('READY_FOR_HUMAN_REVIEW');
    expect(result.humanCertificationRequired).toBe(false);
  });

  it('does not treat an unsigned MT-1 as complete', () => {
    const result = auditFemaLomaEvidence({
      caseId: '26-05-2022A',
      firmClearlyOutsideSfha: false,
      deedOrPlat: [evidence('RECORDED_DEED')],
      assessorMap: evidence('TAX_ASSESSOR_MAP'),
      firmEvidence: evidence('FIRM_MAP'),
      elevationForm: evidence('MT1_FORM_2'),
      mt1: {
        condition: 'EXISTING',
        constructionTypes: ['SLAB_ON_GRADE'],
        subsidenceOrUplift: 'NO',
        verticalDatum: 'NAVD88',
        structureLatitude: 38.0,
        structureLongitude: -87.0,
        propertyLatitude: 38.0,
        propertyLongitude: -87.0,
        lowestLotElevationFt: 377.2,
        lowestAdjacentGradeFt: 377.2,
        bfeFt: 375.0,
        bfeSource: 'FEMA FIS/FIRM evidence',
      },
      professionalCertification: {
        signaturePresent: false,
      },
    });

    expect(result.submissionStatus).toBe('BLOCKED');
    expect(result.humanCertificationRequired).toBe(true);
  });
});