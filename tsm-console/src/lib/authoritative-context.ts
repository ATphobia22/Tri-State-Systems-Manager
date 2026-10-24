/**
 * Authoritative context aggregator for TSM loaders and map twin.
 * Surfaces missing context / authoritative inputs as structured gaps —
 * never invents elevation, flood category, or regulatory determinations.
 */

import { SITE } from '../types/site';
import { FIRM_SSOT, FIRM_PANEL_CANDIDATES, type FirmPanelRecord } from './firm-panel-ssot';
import { GAGE_DATUM_TABLE, type GageDatumRecord } from './gage-datums';
import {
  TSM_DATA_FABRICS,
  listMissingDataFabrics,
  type TsmDataFabric,
} from './data-fabric-registry';

export type ContextGapSeverity = 'info' | 'warning' | 'blocking_for_regulatory';

export interface ContextGap {
  readonly id: string;
  readonly severity: ContextGapSeverity;
  readonly message: string;
  readonly remediation: string;
  readonly relatedFabricIds: readonly string[];
}

export interface LiveFabricRef {
  readonly id: string;
  readonly authority: string;
  readonly endpoint: string;
  readonly ingestModule: string;
  readonly role: string;
}

/** Primary real-time fabrics (mirrors contracts registry; browser-safe static). */
export const REALTIME_FABRIC_REFS: readonly LiveFabricRef[] = Object.freeze([
  {
    id: 'usgs-nwis-iv',
    authority: 'USGS',
    endpoint:
      'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=03378500&parameterCd=00065',
    ingestModule: 'server/ingestion/usgs-nwis.mjs',
    role: 'Gage height IV — via TSM hydrologic API only from browser',
  },
  {
    id: 'usgs-ogc-latest-continuous',
    authority: 'USGS',
    endpoint:
      'https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items',
    ingestModule: 'server/ingestion/usgs-nwis.mjs',
    role: 'Modern OGC continuous observations',
  },
  {
    id: 'noaa-nwps-api',
    authority: 'NOAA/NWS',
    endpoint: 'https://api.water.noaa.gov/nwps/v1/gauges/MTVI3',
    ingestModule: 'server/ingestion/noaa-nwps.mjs',
    role: 'NWPS stage categories / observations (reject -999)',
  },
  {
    id: 'fema-nfhl-mapserver',
    authority: 'FEMA',
    endpoint: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
    ingestModule: 'server/ingestion/fema-nfhl.mjs',
    role: 'NFHL digital layers — informational until human decision',
  },
  {
    id: 'usgs-3dep-elevation',
    authority: 'USGS',
    endpoint:
      'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
    ingestModule: 'server/ingestion/usgs-tnm.mjs',
    role: '3DEP elevation presentation / analysis',
  },
  {
    id: 'nws-api-points',
    authority: 'NWS',
    endpoint: 'https://api.weather.gov/points/37.8459,-88.0051',
    ingestModule: 'server/ingestion/nws-weather.mjs',
    role: 'Weather point / forecast grid',
  },
]);

export interface AuthoritativeContextSnapshot {
  readonly generatedAt: string;
  readonly principle: string;
  readonly site: {
    readonly scope: string;
    readonly county: string;
    readonly region: string;
    readonly elevationEvidenceStatus: string;
    readonly verticalDatum: string;
    readonly horizontalEpsg: number;
  };
  readonly firm: {
    readonly communityId: string;
    readonly effectivePanelId: string;
    readonly verificationStatus: string;
    readonly nfhlMapServer: string;
    readonly mscPortal: string;
    readonly pendingPanels: readonly FirmPanelRecord[];
  };
  readonly gages: {
    readonly primaryUsgs: string;
    readonly primaryNws: string;
    readonly records: readonly GageDatumRecord[];
    readonly navd88ConversionAvailable: boolean;
  };
  readonly fabricsImplemented: number;
  readonly fabricsLiveCapable: number;
  readonly missingImplementedFabrics: readonly TsmDataFabric[];
  readonly gaps: readonly ContextGap[];
  readonly realtimeFabricRefs: readonly LiveFabricRef[];
  readonly allAuthoritativeInputsPresent: boolean;
}

function buildGaps(): ContextGap[] {
  const gaps: ContextGap[] = [];

  if (SITE.elevationEvidenceStatus === 'LEGACY_SCENARIO_REQUIRES_PROJECT_EVIDENCE') {
    gaps.push({
      id: 'site-elevation-legacy',
      severity: 'blocking_for_regulatory',
      message:
        'Site elevation fields are community-scope / legacy scenario placeholders — not project survey evidence.',
      remediation:
        'Supply project elevation certificate / surveyed LAG-FFE with explicit NAVD88 (or documented datum) before regulatory claims.',
      relatedFabricIds: ['terrain-elevation', 'geodetic-datum'],
    });
  }

  if (SITE.crs.verticalDatum === 'UNVERIFIED' || !SITE.crs.verticalDatum) {
    gaps.push({
      id: 'vertical-datum-unverified',
      severity: 'blocking_for_regulatory',
      message: 'Community SITE vertical datum is UNVERIFIED at the constants layer.',
      remediation:
        'Use gage-datums + geodetic-pipeline with documented product-matched conversion; never silent NGVD29↔NAVD88.',
      relatedFabricIds: ['geodetic-datum', 'hydrology'],
    });
  }

  const stages = SITE.noaaGauge.stages;
  if (
    stages.action == null &&
    stages.minor == null &&
    stages.moderate == null &&
    stages.major == null
  ) {
    gaps.push({
      id: 'nws-flood-categories-unset',
      severity: 'warning',
      message:
        'NWS flood category thresholds are null in SITE constants — category may show unknown until live NWPS metadata is applied.',
      remediation:
        'Populate from NWPS gauge product or leave unknown; do not invent action/minor/moderate/major stages.',
      relatedFabricIds: ['hydrology'],
    });
  }

  const primary = GAGE_DATUM_TABLE['03378500'];
  if (primary && (!primary.conversionPublished || primary.gageZeroNavd88Ft == null)) {
    gaps.push({
      id: 'gage-zero-not-published-for-conversion',
      severity: 'info',
      message:
        'USGS 03378500 has station altitude metadata but no published parameter-00065→NAVD88 gage-zero conversion in TSM.',
      remediation:
        'Keep vertical_reference=GAGE_DATUM. Promote WSE only after human-verified station product documentation.',
      relatedFabricIds: ['hydrology', 'geodetic-datum'],
    });
  }

  const pending = FIRM_PANEL_CANDIDATES.filter((p) => p.status === 'PENDING_MSC_VERIFY');
  if (pending.length) {
    gaps.push({
      id: 'firm-panel-pending-msc',
      severity: 'info',
      message: `${pending.length} FIRM panel candidate(s) remain PENDING_MSC_VERIFY (alternate/historical).`,
      remediation:
        'Canonical panel uses NFHL_REST_VERIFIED community scope. Confirm current MSC product before any NFIP filing.',
      relatedFabricIds: ['flood-regulatory'],
    });
  }

  const missingFabrics = listMissingDataFabrics();
  for (const f of missingFabrics) {
    gaps.push({
      id: `fabric-not-implemented-${f.id}`,
      severity: 'warning',
      message: `Data fabric "${f.id}" is not marked implemented.`,
      remediation: f.notes,
      relatedFabricIds: [f.id],
    });
  }

  return gaps;
}

/**
 * Build a snapshot of authoritative inputs and explicit gaps.
 * Safe for loaders and UI banners — does not fetch network.
 */
export function getAuthoritativeContextSnapshot(): AuthoritativeContextSnapshot {
  const gaps = buildGaps();
  const missingImplementedFabrics = listMissingDataFabrics();
  const blocking = gaps.some((g) => g.severity === 'blocking_for_regulatory');

  return {
    generatedAt: new Date().toISOString(),
    principle:
      'Technology informs people; it does not silently govern people. Human authority remains final.',
    site: {
      scope: SITE.address,
      county: SITE.county,
      region: SITE.region,
      elevationEvidenceStatus: SITE.elevationEvidenceStatus,
      verticalDatum: String(SITE.crs.verticalDatum),
      horizontalEpsg: SITE.crs.horizontalEpsg,
    },
    firm: {
      communityId: FIRM_SSOT.communityId,
      effectivePanelId: FIRM_SSOT.effectivePanelId,
      verificationStatus: FIRM_SSOT.verificationStatus,
      nfhlMapServer: FIRM_SSOT.nfhlMapServer,
      mscPortal: FIRM_SSOT.mscPortal,
      pendingPanels: FIRM_PANEL_CANDIDATES.filter((p) => p.status === 'PENDING_MSC_VERIFY'),
    },
    gages: {
      primaryUsgs: '03378500',
      primaryNws: SITE.noaaGauge.nwsId,
      records: Object.values(GAGE_DATUM_TABLE),
      navd88ConversionAvailable: Object.values(GAGE_DATUM_TABLE).some(
        (g) => g.conversionPublished && g.gageZeroNavd88Ft != null,
      ),
    },
    fabricsImplemented: TSM_DATA_FABRICS.filter((f) => f.implemented).length,
    fabricsLiveCapable: TSM_DATA_FABRICS.filter((f) => f.implemented && f.live).length,
    missingImplementedFabrics,
    gaps,
    realtimeFabricRefs: REALTIME_FABRIC_REFS,
    allAuthoritativeInputsPresent: !blocking && missingImplementedFabrics.length === 0,
  };
}

/**
 * Human-readable summary for Trust Fabric / StageAuthority banners.
 */
export function formatContextGapsForUi(
  snapshot: AuthoritativeContextSnapshot = getAuthoritativeContextSnapshot(),
): string {
  if (snapshot.gaps.length === 0) {
    return 'All registered data fabrics implemented; no open context gaps in registry.';
  }
  return snapshot.gaps
    .map((g) => `[${g.severity}] ${g.message}`)
    .join(' · ');
}

export const AUTHORITATIVE_CONTEXT_VERSION = '1.0.0' as const;
