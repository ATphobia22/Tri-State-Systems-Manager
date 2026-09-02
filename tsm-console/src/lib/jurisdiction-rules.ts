/**
 * Multi-state regulatory profiles — CITATIONS only, never silent determinations.
 * human_gate: true for all compliance findings.
 *
 * Indiana compensatory storage policy (S-3):
 * Single published ratio for TSM decision-support UI = 1.2× with ordinance verify gate.
 * 312 IAC 10-2-3 adverse effect = 0.15 ft regulatory flood rise.
 * FEMA-mapped floodway practice = 0.00 ft No-Rise or CLOMR/LOMR.
 */

export type JurisdictionId = 'INDIANA' | 'ILLINOIS' | 'KENTUCKY';

export interface JurisdictionRule {
  id: JurisdictionId;
  name: string;
  code: string;
  source_uri?: string;
  no_rise_threshold_ft: number;
  compensatory_ratio: number;
  freeboard_req_ft: number;
  description: string;
  human_gate: true;
}

/** S-3 published compensatory storage policy (Indiana design default in TSM) */
export const INDIANA_COMPENSATORY_STORAGE_POLICY = {
  ratio: 1.2,
  ratio_label: '1.2× cut volume relative to fill in regulated floodplain storage',
  citation_primary: 'Local floodplain ordinance + IDNR Division of Water practice (verify Posey ordinance text)',
  citation_iac_adverse: '312 IAC 10-2-3 — adverse effect ≥ 0.15 ft regulatory flood elevation increase',
  citation_fema_floodway: '44 CFR 60.3(d) practice — 0.00 ft No-Rise or CLOMR/LOMR in FEMA floodway',
  citation_building: '312 IAC 10-3-5 — buildings >400 ft² require flood protection grade (commonly BFE+2 ft freeboard in local/state practice)',
  note:
    'TSM default ratio is 1.2× for decision-support packaging only. PE and local floodplain administrator may require different ratios by elevation band. Never auto-approve cut-fill balance.',
  human_gate: true as const,
} as const;

export const JURISDICTION_RULES: Record<JurisdictionId, JurisdictionRule> = {
  INDIANA: {
    id: 'INDIANA',
    name: 'Indiana DNR & FEMA Region V',
    code: 'IDNR 312 IAC 10 / IC 14-28-1 / IC 14-28-3 / 44 CFR Part 60',
    source_uri: 'https://www.in.gov/dnr/water/',
    no_rise_threshold_ft: 0.0,
    compensatory_ratio: INDIANA_COMPENSATORY_STORAGE_POLICY.ratio,
    freeboard_req_ft: 2.0,
    description:
      'FEMA floodway: 0.00 ft No-Rise or CLOMR/LOMR. IDNR adverse effect definition 0.15 ft (312 IAC 10-2-3). Compensatory storage default 1.2× (verify local ordinance). Building freeboard commonly +2.0 ft (312 IAC 10-3-5 flood protection grade practice).',
    human_gate: true,
  },
  ILLINOIS: {
    id: 'ILLINOIS',
    name: 'Illinois DNR Office of Water Resources',
    code: '17 Ill. Adm. Code Part 3700 / Part 3708',
    no_rise_threshold_ft: 0.1,
    compensatory_ratio: 1.0,
    freeboard_req_ft: 1.0,
    description:
      '0.10 ft stage threshold criterion often cited for regulatory floodway impacts. Confirm current IDNR OWR rules.',
    human_gate: true,
  },
  KENTUCKY: {
    id: 'KENTUCKY',
    name: 'Kentucky Energy & Environment Cabinet',
    code: '401 KAR 4:060 Floodplain Management',
    no_rise_threshold_ft: 0.0,
    compensatory_ratio: 1.0,
    freeboard_req_ft: 1.0,
    description:
      'Strict no-impact standard commonly applied for ordinary floodway encroachments. Confirm current KAR text.',
    human_gate: true,
  },
};

/** Decision-support finding only — not a regulatory determination */
export function assessClearanceSupport(opts: {
  jurisdiction: JurisdictionId;
  waterStageFt: number;
  bfeFt: number;
  lagFt: number;
  stageIsGageDatum?: boolean;
}): {
  isViolationSupport: boolean;
  isWarningSupport: boolean;
  code: string;
  finding: string;
  is_simulation_demo: true;
  note: string;
  regulatory_banner: string;
} {
  const rule = JURISDICTION_RULES[opts.jurisdiction];
  const clearanceFt = opts.lagFt - opts.waterStageFt;
  const stageAboveBfe = opts.waterStageFt - opts.bfeFt;
  let isViolationSupport = false;
  let isWarningSupport = false;
  let finding = 'BASELINE';

  if (opts.stageIsGageDatum) {
    finding = 'STAGE IS GAGE_DATUM — do not compare directly to NAVD88 BFE/LAG without conversion';
    isWarningSupport = true;
  } else if (clearanceFt < 0) {
    isViolationSupport = true;
    finding = 'STRUCTURAL INUNDATION (LAG BREACHED) — decision support only';
  } else if (opts.jurisdiction === 'ILLINOIS' && stageAboveBfe > rule.no_rise_threshold_ft) {
    isViolationSupport = true;
    finding = 'EXCEEDS IL THRESHOLD CITATION — human review required';
  } else if (opts.jurisdiction === 'KENTUCKY' && stageAboveBfe > rule.no_rise_threshold_ft) {
    isViolationSupport = true;
    finding = 'EXCEEDS KY NO-IMPACT CITATION — human review required';
  } else if (opts.jurisdiction === 'INDIANA' && stageAboveBfe > 0) {
    isWarningSupport = true;
    finding = 'BFE EXCEEDED — CLOMR/LOMR path may apply (IDNR/FEMA) — human review required';
  }

  if (!isViolationSupport && !isWarningSupport && clearanceFt < 1.0 && !opts.stageIsGageDatum) {
    isWarningSupport = true;
    finding = 'LOW CLEARANCE — review freeboard policy';
  }

  return {
    isViolationSupport,
    isWarningSupport,
    code: isViolationSupport
      ? 'CRITICAL — DECISION SUPPORT'
      : isWarningSupport
        ? 'WARNING — DECISION SUPPORT'
        : 'COMPLIANT — DECISION SUPPORT',
    finding,
    is_simulation_demo: true,
    note: 'Not a regulatory determination. Slider/stage inputs may be SIMULATION_DEMO or GAGE_DATUM.',
    regulatory_banner:
      'NOT A REGULATORY DETERMINATION — citations only. Human authority final (ADR-004).',
  };
}

export const FARA_TRIGGERS = {
  source: 'Indiana DNR Division of Water — INFIP',
  portal:
    'https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal',
  short_links: ['https://www.in.gov/infip', 'https://www.in.gov/fip'],
  required_when: [
    'Development in FEMA Zone A',
    'LOMA applications in Zone A',
    'Upstream drainage area greater than 1 square mile',
    'Unmapped on FIRM',
    'Known flood-prone areas',
  ],
  outputs: ['BFE (NAVD88)', 'Flood zone on FIRM', 'Best Available / BAFL status', 'Local floodplain administrator contact'],
  human_gate: true as const,
  note: 'TSM may deep-link to INFIP and store user-saved FARA PDFs as EvidenceArtifacts. TSM does not issue FARA determinations.',
};

export const DNR_FLOODPLAIN_RESOURCES = {
  state_engineering:
    'https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/state-engineering-resources',
  homeowner_info:
    'https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/floodplain-management-and-homeowner-information',
  modeling_guidelines: 'State Engineering Resources → Modeling Guidelines',
  model_library: 'Indiana Hydrology and Hydraulics Model Library (FIS, floodway, FARA models)',
  flood_control_act: 'IC 14-28-1',
  floodplain_management_act: 'IC 14-28-3',
  iac_article: '312 IAC 10',
};

export const TSM_FARA_ROLE = {
  may: [
    'Deep-link INFIP',
    'Store user-provided FARA PDF as EvidenceArtifact',
    'Display FARA trigger conditions as guidance',
  ],
  must_not: [
    'Generate FARA',
    'Approve floodway permits',
    'Issue No-Rise certification',
    'Substitute for DNR ESC or local floodplain administrator',
  ],
} as const;

export const INDIANA_CUMULATIVE_SURCHARGE = {
  dnr_policy_ft: 0.14,
  iac_adverse_threshold_ft: 0.15,
  iac_citation: '312 IAC 10-2-3',
  fema_floodway_development: '0.00 ft No-Rise or CLOMR/LOMR (44 CFR 60.3(d)(3) practice)',
  cumulative_means: 'proposed + existing + anticipated development',
  human_gate: true as const,
} as const;
