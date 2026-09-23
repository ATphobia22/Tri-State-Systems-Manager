/**
 * Multi-state regulatory profiles — CITATIONS only, never silent determinations.
 *
 * Posey compensatory (verified 2026-09-02):
 * Subdivision Ordinance — fill in floodplain offset by equal volume of cutting (1.0×).
 * TSM default ratio updated to 1.0 to match Posey text; PE may still require more.
 */

export type JurisdictionId = 'INDIANA' | 'ILLINOIS' | 'KENTUCKY';

export interface JurisdictionRule {
  id: JurisdictionId;
  name: string;
  code: string;
  source_uri?: string;
  no_rise_threshold_ft?: number;
  compensatory_ratio?: number;
  freeboard_req_ft?: number;
  description: string;
  human_gate: true;
}

/** S-3 Posey-aligned compensatory storage policy */
export const INDIANA_COMPENSATORY_STORAGE_POLICY = {
  ratio: 1.0,
  ratio_label: 'Equal-volume cutting offset; source-bound local rule reference only.',
  citation_source: 'https://www.poseycountyin.gov/wp-content/uploads/2020/09/New-Subdivision-Ordinance-7-01-2013.pdf',
  human_gate: true as const,
} as const;

export const JURISDICTION_RULES: Record<JurisdictionId, JurisdictionRule> = {
  INDIANA: {
    id: 'INDIANA',
    name: 'Indiana DNR / FEMA',
    code: '312 IAC 10 / IC 14-28-1 / applicable FEMA requirements',
    source_uri: 'https://www.in.gov/dnr/water/',
    no_rise_threshold_ft: 0.0,
    compensatory_ratio: INDIANA_COMPENSATORY_STORAGE_POLICY.ratio,
    human_gate: true,
    description: 'Numeric criteria are source-bound and pathway-specific; 0.00 ft applies to the applicable FEMA floodway no-rise pathway, while Indiana DNR criteria are evaluated separately.',
  },
  ILLINOIS: {
    id: 'ILLINOIS',
    name: 'Illinois Department of Natural Resources',
    code: '17 Ill. Adm. Code Part 3700',
    source_uri: 'https://dnr.illinois.gov/waterresources/3700rule.html',
    human_gate: true,
    description: 'Rule registry is authoritative for the citation; no unsupported numeric threshold is hard-coded here.',
  },
  KENTUCKY: {
    id: 'KENTUCKY',
    name: 'Kentucky Administrative Regulations',
    code: '401 KAR 4:060',
    source_uri: 'https://apps.legislature.ky.gov/law/kar/titles/401/004/060/',
    human_gate: true,
    description: 'Rule text is authoritative; no unsupported numeric threshold is hard-coded here.',
  },
};

export function assessClearanceSupport(opts: {
  jurisdiction: JurisdictionId;
  waterStageFt: number;
  bfeFt: number;
  lagFt: number;
  stageIsGageDatum?: boolean;
  projectWseRiseFt?: number;
}): {
  isViolationSupport: boolean;
  isWarningSupport: boolean;
  code: string;
  finding: string;
  is_simulation_demo: true;
  note: string;
  regulatory_banner: string;
} {
  const clearanceFt = opts.lagFt - opts.waterStageFt;
  const riseFt = opts.projectWseRiseFt;
  let isViolationSupport = false;
  let isWarningSupport = false;
  let finding = 'BASELINE';

  if (opts.stageIsGageDatum) {
    finding = 'STAGE IS GAGE_DATUM — do not compare directly to NAVD88 BFE/LAG without conversion';
    isWarningSupport = true;
  } else if (clearanceFt < 0) {
    isWarningSupport = true;
    finding = 'STRUCTURAL INUNDATION SUPPORT — decision support only; not a regulatory determination';
  } else if (riseFt !== undefined && !Number.isFinite(riseFt)) {
    isWarningSupport = true;
    finding = 'PROJECT WSE RISE IS INVALID — hydraulic comparison blocked';
  } else if (riseFt !== undefined && opts.jurisdiction === 'INDIANA' && riseFt > 0) {
    isWarningSupport = true;
    finding = 'PROJECT WSE RISE ABOVE 0.00 FT — FEMA floodway no-rise/CLOMR pathway requires human review';
  } else if (riseFt !== undefined && opts.jurisdiction !== 'INDIANA') {
    isWarningSupport = true;
    finding = 'PROJECT WSE RISE REQUIRES JURISDICTION-SPECIFIC REVIEW — do not compare stage-above-BFE to a floodway rise threshold';
  } else if (opts.jurisdiction === 'INDIANA' && opts.waterStageFt > opts.bfeFt) {
    isWarningSupport = true;
    finding = 'BFE EXCEEDED — flood-risk decision support only; applicable FEMA/IDNR pathway requires human review';
  }

  return {
    isViolationSupport,
    isWarningSupport,
    code: isViolationSupport
      ? 'CRITICAL — DECISION SUPPORT'
      : isWarningSupport
        ? 'WARNING — DECISION SUPPORT'
        : 'BASELINE — DECISION SUPPORT',
    finding,
    is_simulation_demo: true,
    note: 'Not a regulatory determination. FEMA floodway no-rise is a project-condition-versus-base-condition WSE comparison; it must not be inferred from water stage minus BFE.',
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
