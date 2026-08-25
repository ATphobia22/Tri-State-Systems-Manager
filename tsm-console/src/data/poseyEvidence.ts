export type PoseyEvidenceStatus = 'verified' | 'legacy_unverified';
export type PoseyAuthorityLevel = 'government' | 'project';
export type PoseyGrantStatus = 'current' | 'closed' | 'program';

export interface PoseyEvidenceRecord {
  id: string;
  title: string;
  agency: string;
  authorityLevel: PoseyAuthorityLevel;
  status: PoseyEvidenceStatus;
  claim: string;
  sourceUrl: string;
  acquiredAt: string;
  notes: string;
}

export interface PoseyGrantRecord {
  id: string;
  agency: string;
  program: string;
  useCase: string;
  status: PoseyGrantStatus;
  deadline: string;
  match: string;
  sourceUrl: string;
  nextAction: string;
}

export interface PoseyPriority {
  id: string;
  title: string;
  beneficiaries: string;
  outcomes: string[];
  firstActions: string[];
}

const OFFICIAL = '2026-08-25';

export const POSEY_EVIDENCE: readonly PoseyEvidenceRecord[] = [
  {
    id: 'DNR-INFIP',
    title: 'Indiana Floodplain Information Portal',
    agency: 'Indiana Department of Natural Resources',
    authorityLevel: 'government',
    status: 'verified',
    claim: 'Official Indiana floodplain information and FARA workflow.',
    sourceUrl: 'https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/',
    acquiredAt: OFFICIAL,
    notes: 'Use for Indiana regulatory floodplain information; preserve FEMA and DNR layers separately.',
  },
  {
    id: 'DNR-BAFL',
    title: 'Best Available Flood Hazard Layer',
    agency: 'Indiana Department of Natural Resources',
    authorityLevel: 'government',
    status: 'verified',
    claim: 'Official DNR Best Available flood-hazard service; native service CRS is EPSG:26916.',
    sourceUrl: 'https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer/0',
    acquiredAt: OFFICIAL,
    notes: 'Best Available is not itself a FEMA flood-insurance determination layer.',
  },
  {
    id: 'USGS-03378500',
    title: 'Wabash River at New Harmony, IN — 03378500',
    agency: 'U.S. Geological Survey',
    authorityLevel: 'government',
    status: 'verified',
    claim: 'Posey County USGS stream-gage record with continuous discharge and gage-height observations.',
    sourceUrl: 'https://waterdata.usgs.gov/monitoring-location/USGS-03378500/',
    acquiredAt: OFFICIAL,
    notes: 'Current observations are provisional until USGS finalizes them.',
  },
  {
    id: 'USGS-SIR-2016-5119',
    title: 'Wabash River New Harmony Flood-Inundation Study',
    agency: 'U.S. Geological Survey',
    authorityLevel: 'government',
    status: 'verified',
    claim: 'USGS SIR 2016-5119 provides an existing modeled flood-inundation study around New Harmony.',
    sourceUrl: 'https://pubs.usgs.gov/publication/sir20165119',
    acquiredAt: OFFICIAL,
    notes: 'Reuse only with its documented model scope, assumptions, datum, and limitations.',
  },
  {
    id: 'FEMA-MSC',
    title: 'Flood Map Service Center',
    agency: 'Federal Emergency Management Agency',
    authorityLevel: 'government',
    status: 'verified',
    claim: 'Authoritative federal access point for effective FIRMs and Flood Insurance Study materials.',
    sourceUrl: 'https://msc.fema.gov/',
    acquiredAt: OFFICIAL,
    notes: 'Use effective FEMA mapping as the federal regulatory evidence layer.',
  },
  {
    id: 'INDOT-CCMG-2027',
    title: 'Community Crossings Matching Grant FY2027',
    agency: 'Indiana Department of Transportation',
    authorityLevel: 'government',
    status: 'verified',
    claim: 'Current FY2027 call schedule is published by INDOT; opening is September 1, 2026 and closing is September 30, 2026 at 5 p.m. EDT.',
    sourceUrl: 'https://www.in.gov/indot/doing-business-with-indot/local-public-agency-programs/community-crossing-matching-grant-program/',
    acquiredAt: OFFICIAL,
    notes: 'Confirm current application package and eligibility before submission.',
  },
  {
    id: 'IDEM-319-2027',
    title: 'Clean Water Act Section 319 FFY2027',
    agency: 'Indiana Department of Environmental Management',
    authorityLevel: 'government',
    status: 'verified',
    claim: 'Current FFY2027 solicitation requires the application by September 1, 2026 and references the state application form/instructions.',
    sourceUrl: 'https://www.in.gov/idem/nps/files/funding_319_solicitation_announcement.pdf',
    acquiredAt: OFFICIAL,
    notes: 'The NOI stage had an earlier June 1, 2026 deadline; preserve both dates in application tracking.',
  },
  {
    id: 'OCRA-CDBG',
    title: 'CDBG Construction Grants',
    agency: 'Indiana Office of Community and Rural Affairs',
    authorityLevel: 'government',
    status: 'verified',
    claim: 'CDBG construction pathways include stormwater, public facilities, wastewater and drinking-water improvements.',
    sourceUrl: 'https://www.in.gov/ocra/cdbg/cdbg-construction-grants/',
    acquiredAt: OFFICIAL,
    notes: 'Eligibility, national objective, match, scoring, and cycle dates must be checked in the current application package.',
  },
  {
    id: 'USDA-EWP-IN',
    title: 'Emergency Watershed Protection — Indiana',
    agency: 'USDA Natural Resources Conservation Service',
    authorityLevel: 'government',
    status: 'verified',
    claim: 'Emergency watershed recovery pathway for imminent threats from natural disasters.',
    sourceUrl: 'https://www.nrcs.usda.gov/programs-initiatives/ewp-emergency-watershed-protection/indiana/emergency-watershed-protection',
    acquiredAt: OFFICIAL,
    notes: 'Event-driven; local sponsor and eligibility conditions apply.',
  },
  {
    id: 'USDA-WEP',
    title: 'Water & Waste Disposal Loan and Grant Program',
    agency: 'USDA Rural Development',
    authorityLevel: 'government',
    status: 'verified',
    claim: 'Federal rural water, wastewater and related infrastructure financing/grant pathway.',
    sourceUrl: 'https://www.rd.usda.gov/programs-services/water-environmental-programs/water-waste-disposal-loan-grant-program',
    acquiredAt: OFFICIAL,
    notes: 'Project, rural-eligibility, environmental, engineering and financial review applies.',
  },
  {
    id: 'USACE-CAP-205',
    title: 'Continuing Authorities Program Section 205',
    agency: 'U.S. Army Corps of Engineers',
    authorityLevel: 'government',
    status: 'verified',
    claim: 'Small flood-risk-management project authority subject to federal-interest, feasibility, cost-share and sponsor requirements.',
    sourceUrl: 'https://www.usace.army.mil/Missions/Civil-Works/Project-Planning/Continuing-Authorities-Program/',
    acquiredAt: OFFICIAL,
    notes: 'Use as an engineering study/project pathway, not as a guaranteed grant award.',
  },
  {
    id: 'LEGACY-375',
    title: 'Legacy project BFE assertion',
    agency: 'Project artifact',
    authorityLevel: 'project',
    status: 'legacy_unverified',
    claim: '375.0 ft NAVD88 appears in a project specification as a BFE constant.',
    sourceUrl: '',
    acquiredAt: OFFICIAL,
    notes: 'Not promoted to regulatory evidence until tied to the governing FEMA/DNR/survey record.',
  },
  {
    id: 'LEGACY-3687',
    title: 'Legacy project BFE assertion',
    agency: 'Project artifact',
    authorityLevel: 'project',
    status: 'legacy_unverified',
    claim: '368.7 ft NAVD88 appears in an earlier project methodology as a BFE value.',
    sourceUrl: '',
    acquiredAt: OFFICIAL,
    notes: 'Conflicting legacy value; requires authoritative source reconciliation before engineering use.',
  },
] as const;

export const POSEY_GRANTS: readonly PoseyGrantRecord[] = [
  {
    id: 'CCMG-2027', agency: 'INDOT', program: 'Community Crossings Matching Grant FY2027', useCase: 'Roads and bridges', status: 'current',
    deadline: '2026-09-30 17:00 EDT', match: 'Current INDOT page states 80/20 for counties under 55,000; verify project-specific rules.',
    sourceUrl: 'https://www.in.gov/indot/doing-business-with-indot/local-public-agency-programs/community-crossing-matching-grant-program/',
    nextAction: 'Confirm asset inventory, AMP/PASER requirements, scope, estimates and governing-body authorization.',
  },
  {
    id: '319-2027', agency: 'IDEM', program: 'Clean Water Act Section 319 FFY2027', useCase: 'Watershed and nonpoint-source projects', status: 'current',
    deadline: '2026-09-01', match: 'See current solicitation and application instructions.',
    sourceUrl: 'https://www.in.gov/idem/nps/files/funding_319_solicitation_announcement.pdf',
    nextAction: 'Confirm NOI status, final scope, budget, monitoring plan and State Form 49367/R8 package.',
  },
  {
    id: 'OCRA-STORM', agency: 'OCRA', program: 'CDBG Stormwater Improvements', useCase: 'Stormwater infrastructure', status: 'current',
    deadline: 'Cycle-based', match: 'Current cycle controls match and award limits.',
    sourceUrl: 'https://www.in.gov/ocra/cdbg/cdbg-construction-grants/',
    nextAction: 'Build eligible-project narrative, national-objective evidence, engineering estimate and local match.',
  },
  {
    id: 'USDA-EWP', agency: 'USDA NRCS', program: 'Emergency Watershed Protection', useCase: 'Post-disaster watershed stabilization', status: 'program',
    deadline: 'Event-driven', match: 'Determined by current EWP rules and project eligibility.',
    sourceUrl: 'https://www.nrcs.usda.gov/programs-initiatives/ewp-emergency-watershed-protection/indiana/emergency-watershed-protection',
    nextAction: 'Maintain a ready sponsor packet and document imminent threats after qualifying events.',
  },
  {
    id: 'USACE-205', agency: 'USACE', program: 'CAP Section 205', useCase: 'Flood-risk-management studies/projects', status: 'program',
    deadline: 'Project/funding dependent', match: 'Program-specific cost share and authorization limits apply.',
    sourceUrl: 'https://www.usace.army.mil/Missions/Civil-Works/Project-Planning/Continuing-Authorities-Program/',
    nextAction: 'Prepare a problem statement, sponsor commitment and preliminary engineering evidence.',
  },
  {
    id: 'FEMA-BRIC-ARCHIVE', agency: 'FEMA', program: 'Building Resilient Infrastructure and Communities', useCase: 'Hazard mitigation', status: 'closed',
    deadline: '2026-07-23 (archived opportunity)', match: 'Do not treat archived cycle as currently open.',
    sourceUrl: 'https://www.grants.gov/search-results-detail/361620',
    nextAction: 'Monitor FEMA for the next applicable cycle and keep benefit-cost evidence ready.',
  },
] as const;

export const POSEY_PRIORITIES: readonly PoseyPriority[] = [
  {
    id: 'flood-safety', title: 'Flood Safety & Trusted Elevation Evidence', beneficiaries: 'Residents, farmers, municipalities, emergency managers and property owners',
    outcomes: ['Faster access to authoritative flood information', 'Fewer conflicting elevation claims', 'Better preparedness and mitigation decisions'],
    firstActions: ['Reconcile FEMA/DNR BFE sources', 'Ingest USGS stage/discharge history', 'Publish evidence status per dataset'],
  },
  {
    id: 'roads-bridges', title: 'Reliable Roads, Bridges & Emergency Access', beneficiaries: 'All county residents, schools, employers, responders and freight',
    outcomes: ['Reduced closure risk', 'Prioritized bridge/road investment', 'Improved grant readiness'],
    firstActions: ['Inventory critical corridors', 'Rank flood exposure', 'Prepare INDOT CCMG-ready scopes'],
  },
  {
    id: 'water-quality', title: 'Clean Water & Watershed Health', beneficiaries: 'Households, farms, industry, fisheries and downstream communities',
    outcomes: ['Reduced nonpoint-source pollution', 'Better drainage performance', 'Stronger watershed grant competitiveness'],
    firstActions: ['Map priority drainage areas', 'Build IDEM §319 project concepts', 'Track monitoring and outcomes'],
  },
  {
    id: 'housing', title: 'Safe, Durable & Affordable Housing', beneficiaries: 'Renters, homeowners, seniors and lower-income households',
    outcomes: ['Reduced flood damage', 'More resilient housing stock', 'Better access to preservation/mitigation funding'],
    firstActions: ['Screen housing exposure without exposing PII', 'Identify eligible rehabilitation pathways', 'Build project-level cost estimates'],
  },
  {
    id: 'economic-resilience', title: 'Local Economic & Workforce Resilience', beneficiaries: 'Workers, small businesses, farmers, manufacturers and local governments',
    outcomes: ['Reduced business interruption', 'Stronger infrastructure reliability', 'More coordinated capital investment'],
    firstActions: ['Map critical economic assets', 'Build multi-program capital stacks', 'Track outcomes and local benefit'],
  },
  {
    id: 'public-accountability', title: 'Transparent Public-Interest Governance', beneficiaries: 'Every Posey County resident',
    outcomes: ['Auditable public decisions', 'Clear distinction between facts and proposals', 'Accessible evidence for community review'],
    firstActions: ['Maintain evidence ledger', 'Hash source artifacts', 'Provide accessible public explanations'],
  },
] as const;
