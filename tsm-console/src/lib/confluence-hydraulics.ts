/**
 * confluence-hydraulics.ts — Ohio–Wabash confluence validated hydraulics registry.
 *
 * Wires the ERDC/CHL TR-22-4 validated 2D hydraulic + sediment-transport model
 * and the 20 USACE eHydro hydrographic surveys into the twin's hydraulics
 * layer with authority labels per the repo's provenance standards.
 *
 * Honesty boundaries (fail-closed, never fabricated):
 * - The ERDC numerical model FILES (mesh, boundary conditions, result fields)
 *   were not publicly released with the report. Only the report's documented
 *   scenario definitions are registered here — no model output is synthesized.
 * - eHydro soundings are depths below Ohio River Datum. The ORD→NAVD88 offset
 *   is not in-hand and is NEVER invented; layers carry navd88Offset:'unavailable'.
 * - Dike scenarios are validated federal model alternatives, not TSM
 *   simulations. They are intentionally NOT registered in the flood-sim
 *   diffusion-wave screening picker (different model, different semantics).
 */

export type DikeScenarioStatus = 'validated';

/** A river-training structure from the ERDC report. Elevations in feet (datum as noted). */
export interface DikeStructure {
  location: string;
  count: number;
  crestElevationFt: number | null;
  crestNote: string;
}

export interface DikeScenario {
  id: string;
  name: string;
  description: string;
  structures: DikeStructure[];
  /** Where the scenario is described in ERDC/CHL TR-22-4. */
  reportReference: string;
  status: DikeScenarioStatus;
  /** Validated-model finding quoted from the report (null when the report gives none). */
  reportedOutcome: string | null;
}

export interface EhydroSurvey {
  id: string;
  reach: string;
  surveyDate: string;
  surveyType: string;
  mileStart: number;
  mileEnd: number;
  soundingCount: number;
  depthMinFtBelowORD: number;
  depthMaxFtBelowORD: number;
  authority: string;
  horizontalCRS: string;
  verticalDatum: 'Ohio River Datum';
  /** ORD→NAVD88 offset is not in-hand. Never converted, never invented. */
  navd88Offset: 'unavailable';
}

export type ConfluenceLayerKind = 'model-record' | 'survey-extents';

export interface ConfluenceLayer {
  id: string;
  kind: ConfluenceLayerKind;
  title: string;
  authorityClass: 'OBSERVATION' | 'PLANNING';
  vintage: string;
  crs: string;
  verticalDatum: string;
  /** 'available' = renderable in the twin; 'report-only' = evidence record, no geometry. */
  dataAvailability: 'available' | 'report-only';
  provenance: string;
  datumNote: string;
}

// ---------------------------------------------------------------------------
// ERDC/CHL TR-22-4 — validated confluence model record
// ---------------------------------------------------------------------------

export const ERDC_TR224 = {
  authority: 'USACE Engineer Research and Development Center, Coastal and Hydraulics Laboratory (ERDC-CHL)',
  report: 'ERDC/CHL TR-22-4',
  title: 'Wabash and Ohio River Confluence Hydraulic and Sediment Transport Model Investigation',
  authors: 'Gary L. Bell et al.',
  date: '2022-02',
  doi: '10.21079/11681/43441',
  sponsor: 'USACE Louisville District',
  model: '2D Adaptive Hydraulics (AdH)',
  studyPhases: 'Phase 1 (2013–2015), Phase 2 (2018–2020)',
  fieldData: 'multi-beam bathymetric elevations, bed sediment samples, suspended sediment samples, discharge and velocity measurements',
  validation: 'model hydrodynamic and sediment transport computations adequately replicated water surface slope, flow splits, bed sediment gradations, and suspended sediment concentrations vs field data',
  crs: 'EPSG:4326 (as published; model mesh CRS not released)',
  verticalDatum: 'varies by product — see layer',
  reportSha256: '27727424bc9a990e6dda51b1ec86bcb8f673415e980cc18670330025f2499cfd',
  reportFile: 'offline-data/regional/hydraulics/confluence-study/ERDC-CHL-TR-22-4.pdf',
  modelFilesNote: 'Numerical model files (mesh, boundary conditions, result fields) were not publicly released with the report. Only documented scenario definitions are registered here.',
  provenance: 'Official ERDC Library; vendored 2026-10-01; SHA-256 pinned in offline-data/regional/hydraulics/confluence-study/SHA256SUMS.txt',
} as const;

// ---------------------------------------------------------------------------
// Validated dike scenarios (report text — do NOT invent)
// ---------------------------------------------------------------------------

export const DIKE_SCENARIOS: readonly DikeScenario[] = [
  {
    id: 'base',
    name: 'Base condition',
    description:
      'Existing-conditions baseline with no river training structures. All alternative scenarios are compared against this run.',
    structures: [],
    reportReference: 'ERDC/CHL TR-22-4, Figures 29–30 (pp. 36–37)',
    status: 'validated',
    reportedOutcome: null,
  },
  {
    id: 'it2-w3',
    name: 'It2_W3 — Wabash mouth dike',
    description:
      'A 500 ft long dike extending across approximately 80% of the width of the Wabash River mouth, crest elevation 337.8 ft, plus four level-crested dikes on the Illinois bank at 312 ft.',
    structures: [
      { location: 'Wabash River mouth', count: 1, crestElevationFt: 337.8, crestNote: 'suggested crest elevation' },
      { location: 'Illinois bank', count: 4, crestElevationFt: 312, crestNote: 'level-crested' },
    ],
    reportReference: 'ERDC/CHL TR-22-4, Figure 23 (pp. 28–30)',
    status: 'validated',
    reportedOutcome: null,
  },
  {
    id: 'it2-md',
    name: 'It2_MD — right descending bank field',
    description:
      'Six level-crested dikes on the right descending bank at elevation 312 ft; two dikes on Wabash Island sloped downward from the bank to their tip.',
    structures: [
      { location: 'right descending bank', count: 6, crestElevationFt: 312, crestNote: 'level-crested' },
      { location: 'Wabash Island', count: 2, crestElevationFt: null, crestNote: 'sloped downward from bank to tip' },
    ],
    reportReference: 'ERDC/CHL TR-22-4, Figure 24 (pp. 30–31)',
    status: 'validated',
    reportedOutcome: null,
  },
  {
    id: 'it2-pc330',
    name: 'It2_PC330 — seven-dike plan',
    description:
      'Seven-dike plan in the Phase 1 "most effective" layout with level crests on both weir sets at planned construction dimensions: Illinois bank dikes level-crested at 312 ft from bank intersection to tip; Wabash Island side dikes level-crested at 330 ft from bank intersection to tip.',
    structures: [
      { location: 'Illinois bank', count: 4, crestElevationFt: 312, crestNote: 'level-crested, bank to tip' },
      { location: 'Wabash Island', count: 3, crestElevationFt: 330, crestNote: 'level-crested, bank to tip, construction dimensions' },
    ],
    reportReference: 'ERDC/CHL TR-22-4, Figure 25 (pp. 31–32)',
    status: 'validated',
    reportedOutcome: null,
  },
  {
    id: 'selected',
    name: 'Selected alternative — 3 + 4 level-crested dikes',
    description:
      'Report-selected alternative: three level-crested dikes on Wabash Island at 330 ft and four level-crested dikes on the Illinois shore at 312 ft, crest level from bank to tip so tows can move over the weirs at low pool.',
    structures: [
      { location: 'Wabash Island', count: 3, crestElevationFt: 330, crestNote: 'level-crested emergent' },
      { location: 'Illinois shore', count: 4, crestElevationFt: 312, crestNote: 'level-crested submerged, bank to tip' },
    ],
    reportReference: 'ERDC/CHL TR-22-4, Abstract and p. 43',
    status: 'validated',
    reportedOutcome:
      'Shoaling at and just downstream of the mouth of the Wabash River reduced vs base condition; bar growth on the west side of Wabash Island shows no growth and/or is slightly reduced in areal extent.',
  },
];

/** Fail-closed lookup: unknown scenario ids throw — never return a default. */
export function getDikeScenario(id: string): DikeScenario {
  const found = DIKE_SCENARIOS.find((s) => s.id === id);
  if (!found) {
    throw new Error(`Unknown ERDC dike scenario '${id}'. Validated ids: ${DIKE_SCENARIOS.map((s) => s.id).join(', ')}`);
  }
  return found;
}

export function listDikeScenarios(): readonly DikeScenario[] {
  return DIKE_SCENARIOS;
}

// ---------------------------------------------------------------------------
// eHydro surveys — parsed from the 20 vendored ZIP filenames + sounding stats.
// Extent polygons: tsm-console/public/data/ehydro-survey-extents.geojson
// (bounding boxes from real thinned-XYZ coordinates, EPSG:6475 -> EPSG:4326).
// ---------------------------------------------------------------------------

const EHYDRO_AUTHORITY = 'USACE Louisville District (CELRL), eHydro program';
const EHYDRO_HCRS = 'EPSG:6475 (NAD83(2011) / Kentucky South, US survey feet)';

export const EHYDRO_SURVEYS: readonly EhydroSurvey[] = [
  { id: 'ehydro_OH_LD_CAI_20260914_CS_965_976_SORT', reach: 'CAI', surveyDate: '2026-09-14', surveyType: 'CS', mileStart: 965, mileEnd: 976, soundingCount: 9453, depthMinFtBelowORD: -3.8, depthMaxFtBelowORD: 51.8, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_JTMX_20260923_CS_846_847_SORT', reach: 'JTMX', surveyDate: '2026-09-23', surveyType: 'CS', mileStart: 846, mileEnd: 847, soundingCount: 408, depthMinFtBelowORD: -3.6, depthMaxFtBelowORD: 34.5, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_JTM_20190303_OT_PRS_823_846_SORT', reach: 'JTM', surveyDate: '2019-03-03', surveyType: 'OT', mileStart: 823, mileEnd: 846, soundingCount: 8003, depthMinFtBelowORD: -12.5, depthMaxFtBelowORD: 63.7, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_JTM_20260420_CS_817_828_SORT', reach: 'JTM', surveyDate: '2026-04-20', surveyType: 'CS', mileStart: 817, mileEnd: 828, soundingCount: 6633, depthMinFtBelowORD: -3.5, depthMaxFtBelowORD: 54.5, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_JTM_20260422_CS_805_813_SORT', reach: 'JTM', surveyDate: '2026-04-22', surveyType: 'CS', mileStart: 805, mileEnd: 813, soundingCount: 3826, depthMinFtBelowORD: -0.1, depthMaxFtBelowORD: 61.4, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_JTM_20260423_CS_776_779_SORT', reach: 'JTM', surveyDate: '2026-04-23', surveyType: 'CS', mileStart: 776, mileEnd: 779, soundingCount: 2622, depthMinFtBelowORD: -2.5, depthMaxFtBelowORD: 32.1, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_JTM_20260902_CS_791_793_SORT', reach: 'JTM', surveyDate: '2026-09-02', surveyType: 'CS', mileStart: 791, mileEnd: 793, soundingCount: 1082, depthMinFtBelowORD: 6.2, depthMaxFtBelowORD: 35.1, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_JTM_20260908_CS_782_785_SORT', reach: 'JTM', surveyDate: '2026-09-08', surveyType: 'CS', mileStart: 782, mileEnd: 785, soundingCount: 1561, depthMinFtBelowORD: 2.4, depthMaxFtBelowORD: 24.7, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_OLMX_20260917_OT_963_964_SORT', reach: 'OLMX', surveyDate: '2026-09-17', surveyType: 'OT', mileStart: 963, mileEnd: 964, soundingCount: 515, depthMinFtBelowORD: -2.5, depthMaxFtBelowORD: 34.5, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_OLMX_20260918_OT_941_942_SORT', reach: 'OLMX', surveyDate: '2026-09-18', surveyType: 'OT', mileStart: 941, mileEnd: 942, soundingCount: 405, depthMinFtBelowORD: 7.6, depthMaxFtBelowORD: 31.7, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_OLM_20180607_CS_847_951_SORT', reach: 'OLM', surveyDate: '2018-06-07', surveyType: 'CS', mileStart: 847, mileEnd: 951, soundingCount: 1441, depthMinFtBelowORD: -0.3, depthMaxFtBelowORD: 28.8, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_OLM_20260511_CS_947_950_SORT', reach: 'OLM', surveyDate: '2026-05-11', surveyType: 'CS', mileStart: 947, mileEnd: 950, soundingCount: 2723, depthMinFtBelowORD: 4.9, depthMaxFtBelowORD: 36.0, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_OLM_20260512_CS_954_965_SORT', reach: 'OLM', surveyDate: '2026-05-12', surveyType: 'CS', mileStart: 954, mileEnd: 965, soundingCount: 9536, depthMinFtBelowORD: -2.0, depthMaxFtBelowORD: 64.1, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_OLM_20260722_CS_919_927_SORT', reach: 'OLM', surveyDate: '2026-07-22', surveyType: 'CS', mileStart: 919, mileEnd: 927, soundingCount: 4910, depthMinFtBelowORD: 0.6, depthMaxFtBelowORD: 49.2, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_OLM_20260723_CS_932_934_SORT', reach: 'OLM', surveyDate: '2026-07-23', surveyType: 'CS', mileStart: 932, mileEnd: 934, soundingCount: 1541, depthMinFtBelowORD: 1.5, depthMaxFtBelowORD: 42.1, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_SMT_20260429_CS_918_919_SORT', reach: 'SMT', surveyDate: '2026-04-29', surveyType: 'CS', mileStart: 918, mileEnd: 919, soundingCount: 348, depthMinFtBelowORD: 2.7, depthMaxFtBelowORD: 41.9, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_SMT_20260518_CS_846_878_SORT', reach: 'SMT', surveyDate: '2026-05-18', surveyType: 'CS', mileStart: 846, mileEnd: 878, soundingCount: 21641, depthMinFtBelowORD: -5.4, depthMaxFtBelowORD: 59.9, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_SMT_20260910_CS_870_872_SORT', reach: 'SMT', surveyDate: '2026-09-10', surveyType: 'CS', mileStart: 870, mileEnd: 872, soundingCount: 2390, depthMinFtBelowORD: 5.7, depthMaxFtBelowORD: 27.3, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_SMT_20260921_CS_847_855_SORT', reach: 'SMT', surveyDate: '2026-09-21', surveyType: 'CS', mileStart: 847, mileEnd: 855, soundingCount: 4494, depthMinFtBelowORD: -1.2, depthMaxFtBelowORD: 30.0, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
  { id: 'ehydro_OH_LD_SMT_20260923_CS_865_867_SORT', reach: 'SMT', surveyDate: '2026-09-23', surveyType: 'CS', mileStart: 865, mileEnd: 867, soundingCount: 2461, depthMinFtBelowORD: 2.1, depthMaxFtBelowORD: 40.0, authority: EHYDRO_AUTHORITY, horizontalCRS: EHYDRO_HCRS, verticalDatum: 'Ohio River Datum', navd88Offset: 'unavailable' },
];

/** Fail-closed lookup: unknown survey ids throw — never return a default. */
export function getEhydroSurvey(id: string): EhydroSurvey {
  const found = EHYDRO_SURVEYS.find((s) => s.id === id);
  if (!found) {
    throw new Error(`Unknown eHydro survey '${id}'.`);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Confluence layer definitions (twin layer registry wiring)
// ---------------------------------------------------------------------------

export const CONFLUENCE_LAYERS: readonly ConfluenceLayer[] = [
  {
    id: 'erdc-tr224-model',
    kind: 'model-record',
    title: 'ERDC/CHL TR-22-4 — Wabash–Ohio confluence 2D model (validated)',
    authorityClass: 'PLANNING',
    vintage: '2022-02 (Phase 1 2013–2015, Phase 2 2018–2020)',
    crs: 'EPSG:4326 (as published; model mesh CRS not released)',
    verticalDatum: 'varies by product — see layer',
    dataAvailability: 'report-only',
    provenance:
      'USACE ERDC-CHL for Louisville District; DOI 10.21079/11681/43441; report SHA-256 27727424bc9a990e6dda51b1ec86bcb8f673415e980cc18670330025f2499cfd; vendored 2026-10-01',
    datumNote:
      'Evidence record only: numerical model files (mesh, boundary conditions, result fields) were not publicly released. Scenario definitions are report text, not synthesized outputs.',
  },
  {
    id: 'ehydro-bathymetry-extents',
    kind: 'survey-extents',
    title: 'USACE eHydro bathymetric survey extents — Ohio River RM 776–976',
    authorityClass: 'OBSERVATION',
    vintage: '2018-06-07 through 2026-09-23 (20 surveys)',
    crs: 'EPSG:4326 (extents reprojected from EPSG:6475)',
    verticalDatum: 'Ohio River Datum',
    dataAvailability: 'available',
    provenance:
      'USACE Louisville District (CELRL) eHydro program via public FeatureServer; source ZIPs from official eHydro Azure blob store; vendored 2026-10-01; per-survey SHA-256 in offline-data/regional/hydraulics/bathymetry/raw/SHA256SUMS.txt',
    datumNote:
      'Soundings are depths below Ohio River Datum in feet — a low-water reference plane, NOT NAVD88. ORD→NAVD88 offsets are not in-hand and were never invented. Navigation-channel condition surveys (single-beam, ~200 ft line spacing); not full-riverbed mapping.',
  },
];

/** Fail-closed lookup: unknown layer ids throw — never return a default. */
export function getConfluenceLayer(id: string): ConfluenceLayer {
  const found = CONFLUENCE_LAYERS.find((l) => l.id === id);
  if (!found) {
    throw new Error(`Unknown confluence hydraulics layer '${id}'.`);
  }
  return found;
}
