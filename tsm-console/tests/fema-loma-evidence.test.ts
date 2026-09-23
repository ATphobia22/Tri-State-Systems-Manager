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
