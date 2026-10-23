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
  /**
   * Extended coverage dimensions (NOT-COMPLETE registry item 4).
   * All nullable. Absent values are reported as NOT_CATALOGUED — never invented.
   */
  readonly coordinate_epoch?: number | null;
  readonly units?: string | null;
  readonly accuracy_class?: string | null;
  readonly transform_grid?: string | null;
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
      'Missing CRS or vertical datum is MISSING_CRITICAL — such sources must not be treated as validated; runtime degrades to UNAVAILABLE labeling rather than blocking (resilient posture per standing user directive).',
      'NGVD29↔NAVD88 is not auto-converted without published transform evidence. ' +
        'Per NGS: the shift varies by location (tenths of a foot to several feet); ' +
        'no single offset is valid nationwide. Use NGS VERTCON/NCAT at the lat/lon. ' +
        'See docs/geospatial/vertical-datum-authoritative-reference-2026-10-23.md.',
      'Web Mercator (EPSG:3857) is never treated as engineering metres without explicit bridge.',
      'Report does not invent CRS/datum values for incomplete catalog rows.',
      'Orthometric heights (H, NAVD88) required for flood work — not raw GNSS ellipsoidal heights (h). h = H + N.',
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

// ---------------------------------------------------------------------------
// Catalog coverage harness (NOT-COMPLETE registry item 4).
//
// Evaluates every entry of the platform's supported source catalog across the
// registry's dimensions: horizontal CRS, vertical datum, coordinate epoch,
// units, transformation-grid/version, accuracy class, and source provenance.
//
// Labels are honest by construction:
// - NOT_CATALOGUED: the catalog carries no value for the dimension — reported,
//   never invented.
// - UNKNOWN_UNAVAILABLE: the datum is explicitly 'UNKNOWN' — the vertical
//   transform is unresolvable and is labeled UNAVAILABLE, never approximated.
// - Unsupported or missing values are reported in error categories, never
//   silently skipped.
// ---------------------------------------------------------------------------

export type CoverageDimensionStatus =
  | 'SUPPORTED'
  | 'NONE_NO_VERTICAL'
  | 'UNKNOWN_UNAVAILABLE'
  | 'CATALOGUED'
  | 'NOT_CATALOGUED'
  | 'UNSUPPORTED'
  | 'MISSING'
  | 'PRESENT';

export type VerticalTransformAvailability =
  | 'NATIVE'
  | 'NOT_APPLICABLE'
  | 'UNAVAILABLE'
  | 'UNRESOLVABLE';

export type CoverageEntryStatus =
  | 'VALIDATED'
  | 'UNAVAILABLE'
  | 'INCOMPLETE'
  | 'MISSING_CRITICAL';

export interface CoverageDimension {
  readonly value: string | number | null;
  readonly status: CoverageDimensionStatus;
}

export interface CoverageEntry {
  readonly id: string;
  readonly dataset: string;
  readonly authority: string;
  readonly layerType: string;
  readonly horizontal_crs: CoverageDimension;
  readonly vertical_datum: CoverageDimension & {
    readonly transform_availability: VerticalTransformAvailability;
  };
  readonly coordinate_epoch: CoverageDimension;
  readonly units: CoverageDimension;
  readonly accuracy_class: CoverageDimension;
  readonly transform_grid_version: CoverageDimension;
  readonly source_provenance: CoverageDimension;
  readonly status: CoverageEntryStatus;
  readonly notes: readonly string[];
}

export interface CoverageSkippedRecord {
  readonly id: string | null;
  readonly reason: string;
}

export interface CoverageErrorCategory {
  readonly category: string;
  readonly count: number;
  readonly entries: readonly string[];
}

export interface CatalogCoverageReport {
  readonly schema_version: string;
  readonly report_id: string;
  readonly run_timestamp: string;
  readonly harness: {
    readonly module: string;
    readonly version: string;
    readonly git_commit: string | null;
    readonly git_branch: string | null;
  };
  readonly input_snapshot: {
    readonly catalog_source: string;
    readonly entry_count: number;
    readonly sha256: string;
    readonly pinned_fixture: string;
  };
  readonly coverage: {
    readonly denominator: number;
    readonly numerator: number;
    readonly fraction: number;
  };
  readonly status_counts: Record<CoverageEntryStatus, number>;
  readonly skipped: readonly CoverageSkippedRecord[];
  readonly skip_policy: string;
  readonly error_categories: readonly CoverageErrorCategory[];
  readonly entries: readonly CoverageEntry[];
  readonly ci_hook: {
    readonly npm_script: string;
    readonly command: string;
    readonly description: string;
  };
  readonly notes: readonly string[];
}

export const COVERAGE_HARNESS_VERSION = '1.0.0';

const KNOWN_H_CRS_SET: ReadonlySet<string> = new Set(KNOWN_H_CRS);
const KNOWN_V_DATUM_SET: ReadonlySet<string> = new Set(KNOWN_V_DATUMS);

function provenanceValue(source: CatalogSource): string | null {
  return (
    norm(source.sourceUrl) ??
    norm(source.provenanceClass) ??
    norm(source.acquiredAt) ??
    norm(source.verificationState)
  );
}

/**
 * Evaluate one catalog entry across all registry dimensions.
 * Never invents values; unknown/unresolvable transforms are UNAVAILABLE.
 */
export function evaluateCoverageEntry(source: CatalogSource): CoverageEntry | null {
  const id = norm(source.id);
  if (!id) return null; // cannot be evaluated — becomes a skipped record
  const notes: string[] = [];

  const crsValue = norm(source.crs);
  const crsStatus: CoverageDimensionStatus = !crsValue
    ? 'MISSING'
    : KNOWN_H_CRS_SET.has(crsValue)
      ? 'SUPPORTED'
      : 'UNSUPPORTED';

  const datumValue = norm(source.verticalDatum);
  let datumStatus: CoverageDimensionStatus;
  let transformAvailability: VerticalTransformAvailability;
  if (!datumValue) {
    datumStatus = 'MISSING';
    transformAvailability = 'UNRESOLVABLE';
  } else if (datumValue === 'NONE') {
    datumStatus = 'NONE_NO_VERTICAL';
    transformAvailability = 'NOT_APPLICABLE';
    notes.push('Vertical datum NONE: layer carries no vertical component; no transform applies.');
  } else if (datumValue === 'UNKNOWN') {
    // Explicitly unknown — vertical transform is unresolvable. Labeled
    // UNAVAILABLE; never approximated, never silently converted.
    datumStatus = 'UNKNOWN_UNAVAILABLE';
    transformAvailability = 'UNAVAILABLE';
    notes.push(
      'Vertical datum explicitly UNKNOWN — vertical transform unresolvable; labeled UNAVAILABLE. ' +
        'Example: USGS gage 03378500 stage is reported against an unpublished gage zero, not an orthometric datum.',
    );
  } else if (KNOWN_V_DATUM_SET.has(datumValue)) {
    datumStatus = 'SUPPORTED';
    transformAvailability = 'NATIVE';
    notes.push(`Vertical heights native in ${datumValue}; no datum transform required.`);
  } else {
    datumStatus = 'UNSUPPORTED';
    transformAvailability = 'UNRESOLVABLE';
  }

  const epochValue = source.coordinate_epoch ?? null;
  const unitsValue = norm(source.units);
  const accuracyValue = norm(source.accuracy_class);
  const transformGridValue = norm(source.transform_grid);
  const provenance = provenanceValue(source);

  let status: CoverageEntryStatus;
  if (crsStatus === 'MISSING' || datumStatus === 'MISSING') {
    status = 'MISSING_CRITICAL';
  } else if (datumStatus === 'UNKNOWN_UNAVAILABLE') {
    status = 'UNAVAILABLE';
  } else if (crsStatus === 'UNSUPPORTED' || datumStatus === 'UNSUPPORTED' || !provenance) {
    status = 'INCOMPLETE';
  } else {
    status = 'VALIDATED';
  }

  return {
    id,
    dataset: source.dataset,
    authority: source.authority,
    layerType: source.layerType,
    horizontal_crs: { value: crsValue, status: crsStatus },
    vertical_datum: {
      value: datumValue,
      status: datumStatus,
      transform_availability: transformAvailability,
    },
    coordinate_epoch: {
      value: epochValue,
      status: epochValue == null ? 'NOT_CATALOGUED' : 'CATALOGUED',
    },
    units: { value: unitsValue, status: unitsValue == null ? 'NOT_CATALOGUED' : 'CATALOGUED' },
    accuracy_class: {
      value: accuracyValue,
      status: accuracyValue == null ? 'NOT_CATALOGUED' : 'CATALOGUED',
    },
    transform_grid_version: {
      value: transformGridValue,
      status: transformGridValue == null ? 'NOT_CATALOGUED' : 'CATALOGUED',
    },
    source_provenance: { value: provenance, status: provenance ? 'PRESENT' : 'MISSING' },
    status,
    notes,
  };
}

/** Stable JSON stringify with sorted object keys — shared canonical form for snapshot digests. */
export function canonicalCatalogJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalCatalogJson).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalCatalogJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

function pushError(
  map: Map<string, Set<string>>,
  category: string,
  entryId: string,
): void {
  let set = map.get(category);
  if (!set) {
    set = new Set();
    map.set(category, set);
  }
  set.add(entryId);
}

/**
 * Run the coverage harness over the complete supported source catalog.
 * `gitInfo` is injected by the runner script (kept out of pure function).
 */
export function buildCatalogCoverageReport(
  sources: readonly CatalogSource[],
  opts: {
    catalogSourceLabel?: string;
    snapshotSha256?: string;
    pinnedFixture?: string;
    gitCommit?: string | null;
    gitBranch?: string | null;
    reportId?: string;
  } = {},
): CatalogCoverageReport {
  const entries: CoverageEntry[] = [];
  const skipped: CoverageSkippedRecord[] = [];
  const errorMap = new Map<string, Set<string>>();

  for (const source of sources) {
    const evaluated = evaluateCoverageEntry(source);
    if (!evaluated) {
      skipped.push({
        id: source.id ?? null,
        reason: 'Record has no usable identifier; cannot be evaluated against the catalog.',
      });
      continue;
    }
    entries.push(evaluated);

    if (evaluated.horizontal_crs.status === 'MISSING')
      pushError(errorMap, 'missing-horizontal-crs', evaluated.id);
    if (evaluated.horizontal_crs.status === 'UNSUPPORTED')
      pushError(errorMap, 'unsupported-horizontal-crs', evaluated.id);
    if (evaluated.vertical_datum.status === 'MISSING')
      pushError(errorMap, 'missing-vertical-datum', evaluated.id);
    if (evaluated.vertical_datum.status === 'UNSUPPORTED')
      pushError(errorMap, 'unsupported-vertical-datum', evaluated.id);
    if (evaluated.vertical_datum.status === 'UNKNOWN_UNAVAILABLE')
      pushError(errorMap, 'vertical-datum-unknown-unresolvable-transform', evaluated.id);
    if (evaluated.coordinate_epoch.status === 'NOT_CATALOGUED')
      pushError(errorMap, 'coordinate-epoch-not-catalogued', evaluated.id);
    if (evaluated.units.status === 'NOT_CATALOGUED')
      pushError(errorMap, 'units-not-catalogued', evaluated.id);
    if (evaluated.accuracy_class.status === 'NOT_CATALOGUED')
      pushError(errorMap, 'accuracy-class-not-catalogued', evaluated.id);
    if (evaluated.transform_grid_version.status === 'NOT_CATALOGUED')
      pushError(errorMap, 'transform-grid-version-not-catalogued', evaluated.id);
    if (evaluated.source_provenance.status === 'MISSING')
      pushError(errorMap, 'source-provenance-missing', evaluated.id);
  }

  const statusCounts: Record<CoverageEntryStatus, number> = {
    VALIDATED: 0,
    UNAVAILABLE: 0,
    INCOMPLETE: 0,
    MISSING_CRITICAL: 0,
  };
  for (const e of entries) statusCounts[e.status]++;

  const errorCategories: CoverageErrorCategory[] = [...errorMap.entries()]
    .map(([category, set]) => ({
      category,
      count: set.size,
      entries: [...set].sort(),
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  const denominator = entries.length + skipped.length;
  const numerator = statusCounts.VALIDATED;

  return {
    schema_version: `crs-datum-coverage/${COVERAGE_HARNESS_VERSION}`,
    report_id: opts.reportId ?? 'coverage-report-2026-10-23',
    run_timestamp: new Date().toISOString(),
    harness: {
      module: 'tsm-console/src/lib/crs-vertical-datum-evidence.ts',
      version: COVERAGE_HARNESS_VERSION,
      git_commit: opts.gitCommit ?? null,
      git_branch: opts.gitBranch ?? null,
    },
    input_snapshot: {
      catalog_source:
        opts.catalogSourceLabel ?? 'TSM_SUPPORTED_SOURCE_CATALOG (this module)',
      entry_count: sources.length,
      sha256: opts.snapshotSha256 ?? 'NOT_COMPUTED',
      pinned_fixture:
        opts.pinnedFixture ?? 'tsm-console/tests/fixtures/crs-datum-catalog-snapshot-2026-10-23.json',
    },
    coverage: {
      denominator,
      numerator,
      fraction: denominator === 0 ? 0 : numerator / denominator,
    },
    status_counts: statusCounts,
    skipped,
    skip_policy:
      'A catalog record is skipped only when it cannot be evaluated — i.e. it has no usable identifier. ' +
      'Unknown or unresolvable CRS/datum values are never skipped; they are evaluated and labeled ' +
      '(UNSUPPORTED / UNKNOWN_UNAVAILABLE / MISSING).',
    error_categories: errorCategories,
    entries,
    ci_hook: {
      npm_script: 'check:crs-coverage',
      command: 'cd tsm-console && npm run check:crs-coverage',
      description:
        'Runs the coverage harness against the live catalog and rewrites the committed JSON report. ' +
        'Intended CI regression check: compare the regenerated report against the committed file and the pinned ' +
        'catalog fixture (tests/crs-datum-coverage.test.mjs) without editing .github/workflows.',
    },
    notes: [
      'Denominator = complete supported source catalog: TSM_SUPPORTED_SOURCE_CATALOG (aligned with REQUIRED_OPEN_WORLD_LAYERS + NFHL S_BFE). No entries invented; no records silently skipped.',
      'VALIDATED = supported horizontal CRS + usable vertical datum (NONE accepted for layers with no vertical component) + present source provenance.',
      'UNAVAILABLE = vertical datum explicitly UNKNOWN (e.g. gage-zero / forecast reference); transform unresolvable, never approximated.',
      'coordinate_epoch / units / accuracy_class / transform_grid_version are NOT_CATALOGUED in the current catalog schema — reported as coverage gaps, not invented. Epoch is required by validateFeatureCoordinates only under its requireEpoch policy, not globally.',
      'Metadata presence does not imply survey-grade accuracy.',
      'Human authority remains final.',
    ],
  };
}
