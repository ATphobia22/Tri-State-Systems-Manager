/**
 * CRS and vertical-datum evidence against the supported source catalog.
 * Reports missing metadata and provenance — never invents CRS/datum values.
 */

export interface CatalogSource {
  readonly id: string;
  readonly dataset: string;
  readonly authority: string;
  readonly layerType: string;
  readonly crs: string | null | undefined;
  readonly verticalDatum: string | null | undefined;
  readonly sourceUrl?: string | null;
  readonly status?: string;
  readonly verificationState?: string;
  readonly acquiredAt?: string | null;
  readonly provenanceClass?: string | null;
}

export interface SourceDatumEvidence {
  readonly id: string;
  readonly dataset: string;
  readonly authority: string;
  readonly horizontalCrs: string | null;
  readonly verticalDatum: string | null;
  readonly crsPresent: boolean;
  readonly datumPresent: boolean;
  readonly provenancePresent: boolean;
  readonly missing: readonly string[];
  readonly status: 'COMPLETE' | 'INCOMPLETE' | 'MISSING_CRITICAL';
}

export interface CrsDatumEvidenceReport {
  readonly schema_version: string;
  readonly generated_at: string;
  readonly source_count: number;
  readonly complete_count: number;
  readonly incomplete_count: number;
  readonly missing_critical_count: number;
  readonly sources: readonly SourceDatumEvidence[];
  readonly supported_horizontal_crs: readonly string[];
  readonly supported_vertical_datums: readonly string[];
  readonly notes: readonly string[];
  readonly authority: 'EVIDENCE_REPORT';
}

const KNOWN_H_CRS = [
  'EPSG:4326',
  'EPSG:3857',
  'EPSG:2965',
  'EPSG:2966',
  'NAD83',
  'WGS84',
  'local-ENU-approx',
] as const;

const KNOWN_V_DATUMS = [
  'NAVD88',
  'NGVD29',
  'ELLIPSOID_WGS84',
  'UNKNOWN',
  'NONE',
] as const;

function norm(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t.length ? t : null;
}

export function evaluateSourceDatumEvidence(source: CatalogSource): SourceDatumEvidence {
  const horizontalCrs = norm(source.crs);
  const verticalDatum = norm(source.verticalDatum);
  const provenancePresent = Boolean(
    norm(source.sourceUrl) ||
      norm(source.provenanceClass) ||
      norm(source.acquiredAt) ||
      norm(source.verificationState),
  );
  const missing: string[] = [];
  if (!horizontalCrs) missing.push('horizontal_crs');
  if (!verticalDatum) missing.push('vertical_datum');
  if (!provenancePresent) missing.push('provenance');

  let status: SourceDatumEvidence['status'] = 'COMPLETE';
  if (missing.includes('horizontal_crs') || missing.includes('vertical_datum')) {
    status = 'MISSING_CRITICAL';
  } else if (missing.length) {
    status = 'INCOMPLETE';
  }

  return {
    id: source.id,
    dataset: source.dataset,
    authority: source.authority,
    horizontalCrs,
    verticalDatum,
    crsPresent: Boolean(horizontalCrs),
    datumPresent: Boolean(verticalDatum),
    provenancePresent,
    missing,
    status,
  };
}

export function buildCrsDatumEvidenceReport(
  sources: readonly CatalogSource[],
): CrsDatumEvidenceReport {
  const evaluated = sources.map(evaluateSourceDatumEvidence);
  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    source_count: evaluated.length,
    complete_count: evaluated.filter((s) => s.status === 'COMPLETE').length,
    incomplete_count: evaluated.filter((s) => s.status === 'INCOMPLETE').length,
    missing_critical_count: evaluated.filter((s) => s.status === 'MISSING_CRITICAL').length,
    sources: evaluated,
    supported_horizontal_crs: [...KNOWN_H_CRS],
    supported_vertical_datums: [...KNOWN_V_DATUMS],
    notes: [
      'Missing CRS or vertical datum is MISSING_CRITICAL — runtime must fail closed.',
      'NGVD29↔NAVD88 is not auto-converted without published transform evidence.',
      'Web Mercator (EPSG:3857) is never treated as engineering metres without explicit bridge.',
      'Report does not invent CRS/datum values for incomplete catalog rows.',
    ],
    authority: 'EVIDENCE_REPORT',
  };
}

/** Built-in catalog slice aligned with REQUIRED_OPEN_WORLD_LAYERS + terrain. */
export const TSM_SUPPORTED_SOURCE_CATALOG: readonly CatalogSource[] = [
  {
    id: 'usgs-3dep-terrain',
    dataset: 'USGS 3DEP',
    authority: 'USGS',
    layerType: 'terrain',
    crs: 'EPSG:3857',
    verticalDatum: 'NAVD88',
    sourceUrl: 'https://elevation.nationalmap.gov/',
    status: 'PROGRAM_PENDING',
    verificationState: 'PENDING',
    provenanceClass: 'federal-elevation',
  },
  {
    id: 'fema-effective',
    dataset: 'NFHL Effective',
    authority: 'FEMA',
    layerType: 'vector',
    crs: 'EPSG:4326',
    verticalDatum: 'NAVD88',
    sourceUrl: 'https://hazards.fema.gov/',
    status: 'PUBLISHED',
    verificationState: 'VERIFIED',
    provenanceClass: 'federal-flood',
  },
  {
    id: 'indiana-bafm',
    dataset: 'Indiana Best Available Flood Mapping',
    authority: 'IDNR / IGIO',
    layerType: 'vector',
    crs: 'EPSG:2965',
    verticalDatum: 'NAVD88',
    sourceUrl: null,
    status: 'PROGRAM_PENDING',
    verificationState: 'PENDING',
  },
  {
    id: 'indiana-parcels-2025',
    dataset: 'Indiana Parcels',
    authority: 'IGIO',
    layerType: 'vector',
    crs: 'EPSG:2965',
    verticalDatum: 'NONE',
    sourceUrl: null,
    status: 'PROGRAM_PENDING',
    verificationState: 'PENDING',
  },
  {
    id: 'indiana-current-imagery',
    dataset: 'Indiana Imagery',
    authority: 'IGIO',
    layerType: 'raster',
    crs: 'EPSG:3857',
    verticalDatum: 'NONE',
    sourceUrl: null,
    status: 'PROGRAM_PENDING',
    verificationState: 'PENDING',
  },
  {
    id: 'usgs-03378500',
    dataset: 'USGS Gage 03378500 stage',
    authority: 'USGS',
    layerType: 'live-observation',
    crs: 'EPSG:4326',
    verticalDatum: 'UNKNOWN',
    sourceUrl: 'https://waterdata.usgs.gov/monitoring-location/USGS-03378500/',
    status: 'PUBLISHED',
    verificationState: 'VERIFIED',
    notes_via_gage: 'gage-zero conversion unpublished',
  } as CatalogSource,
  {
    id: 'noaa-nwps',
    dataset: 'NOAA NWPS',
    authority: 'NWS',
    layerType: 'live-forecast',
    crs: 'EPSG:4326',
    verticalDatum: 'UNKNOWN',
    sourceUrl: 'https://water.noaa.gov/',
    status: 'PUBLISHED',
    verificationState: 'VERIFIED',
  },
  {
    id: 'usace-nld',
    dataset: 'USACE National Levee Database',
    authority: 'USACE',
    layerType: 'vector',
    crs: 'EPSG:4326',
    verticalDatum: 'NAVD88',
    sourceUrl: 'https://levees.sec.usace.army.mil/',
    status: 'PUBLISHED',
    verificationState: 'PROVISIONAL',
  },
  {
    id: 'point-township-historical',
    dataset: 'Point Township historical',
    authority: 'Local / TSM',
    layerType: 'historical-raster',
    crs: 'EPSG:4326',
    verticalDatum: null,
    sourceUrl: null,
    status: 'REQUIRES_DOWNLOAD',
    verificationState: 'HISTORICAL_REFERENCE',
  },
  {
    id: 'nfhl-s-bfe',
    dataset: 'NFHL S_BFE',
    authority: 'FEMA',
    layerType: 'vector',
    crs: 'EPSG:4326',
    verticalDatum: 'NAVD88',
    sourceUrl: 'https://hazards.fema.gov/nfhl/',
    status: 'PUBLISHED',
    verificationState: 'VERIFIED',
    provenanceClass: 'firm-fis-hardcopy-controls',
  },
];
