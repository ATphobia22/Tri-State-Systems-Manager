/**
 * Tri-state pre-submittal regulatory gates (Model Lab).
 * ADR-004 Human-Authority-Final: gates inform; never auto-approve field work.
 */

export type Jurisdiction = 'FEMA' | 'USACE' | 'IN_IDNR' | 'IL_IDNR' | 'KY_811' | 'PHMSA';

export interface DesignProposal {
  id: string;
  crestElevNavd88Ft?: number;
  earthworkVolumeM3?: number;
  intersectsNldLevee?: boolean;
  intersectsFloodway?: boolean;
  qualityLevel?: 'QL-A' | 'QL-B' | 'QL-C' | 'QL-D';
  oneCallTicketGenerated?: boolean;
  slopeRatio?: number;
  bishopFos?: number;
}

export interface GateResult {
  jurisdiction: Jurisdiction;
  statute: string;
  pass: boolean;
  code: string;
  message: string;
  severity: 'block' | 'warn' | 'info';
}

const BFE = 369.1;
const MIN_FOS = 1.5;

export function evaluateFema(p: DesignProposal): GateResult[] {
  const out: GateResult[] = [];
  if (p.intersectsFloodway) {
    out.push({
      jurisdiction: 'FEMA',
      statute: '44 CFR 60.3 / 65.10',
      pass: false,
      code: 'FEMA_FLOODWAY_ENCROACHMENT',
      message: 'Floodway encroachment requires zero-rise analysis + CLOMR/LOMR path',
      severity: 'block',
    });
  }
  if (p.crestElevNavd88Ft != null) {
    const freeboard = p.crestElevNavd88Ft - BFE;
    out.push({
      jurisdiction: 'FEMA',
      statute: '44 CFR 65.10 freeboard',
      pass: freeboard >= 3.0,
      code: 'FEMA_FREEBOARD',
      message: `Crest freeboard vs BFE 369.1 ft = ${freeboard.toFixed(2)} ft`,
      severity: freeboard >= 2.0 ? 'info' : 'block',
    });
  }
  return out;
}

export function evaluateUsace(p: DesignProposal): GateResult[] {
  if (!p.intersectsNldLevee) {
    return [{
      jurisdiction: 'USACE',
      statute: 'Section 408',
      pass: true,
      code: 'USACE_NO_NLD_HIT',
      message: 'No intersection with NLD leveed areas',
      severity: 'info',
    }];
  }
  return [{
    jurisdiction: 'USACE',
    statute: 'Section 408 / 204 / 205 CAP',
    pass: false,
    code: 'USACE_SECTION_408_REQUIRED',
    message: 'NLD intersection → Section 408 package required',
    severity: 'block',
  }];
}

export function bishopFosPass(fos: number): boolean {
  return fos >= MIN_FOS;
}

export function runAllGates(p: DesignProposal): GateResult[] {
  const out: GateResult[] = [];
  out.push(...evaluateFema(p));
  out.push(...evaluateUsace(p));
  if (p.bishopFos != null) {
    out.push({
      jurisdiction: 'IN_IDNR',
      statute: 'Bishop FoS',
      pass: bishopFosPass(p.bishopFos),
      code: 'BISHOP_FOS',
      message: `FoS=${p.bishopFos} gate=${MIN_FOS}`,
      severity: bishopFosPass(p.bishopFos) ? 'info' : 'block',
    });
  }
  if (p.slopeRatio != null) {
    out.push({
      jurisdiction: 'IN_IDNR',
      statute: '312 IAC 10 slope',
      pass: p.slopeRatio >= 3.0,
      code: 'SLOPE_3_TO_1',
      message: `slope_ratio=${p.slopeRatio}`,
      severity: p.slopeRatio >= 3.0 ? 'info' : 'block',
    });
  }
  if (p.qualityLevel === 'QL-C' || p.qualityLevel === 'QL-D') {
    out.push({
      jurisdiction: 'KY_811',
      statute: 'ASCE 38-22',
      pass: true,
      code: 'QL_NO_3D_CLASH',
      message: 'QL-C/D must not extrude as 3D clash solids',
      severity: 'warn',
    });
  }
  if (!p.oneCallTicketGenerated) {
    out.push({
      jurisdiction: 'KY_811',
      statute: '811 one-call',
      pass: false,
      code: 'ONE_CALL_REQUIRED',
      message: 'Generate 811 ticket polygons before excavation',
      severity: 'block',
    });
  }
  return out;
}
