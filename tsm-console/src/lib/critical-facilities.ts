/**
 * Critical-facility inventory for Scenario Studio cascade.
 * Prefer JSON catalog; falls back to built-in SCREENING_CRITICAL_FACILITIES.
 */

import {
  SCREENING_CRITICAL_FACILITIES,
  type CriticalFacility,
} from './scenario-studio';

export type CriticalFacilitiesCatalog = {
  schema: string;
  authorityClass: string;
  source: string;
  disclaimer: string;
  retrievedAt: string;
  features: CriticalFacility[];
};

let cached: CriticalFacilitiesCatalog | null = null;

function mapFeature(raw: Record<string, unknown>): CriticalFacility | null {
  const id = String(raw.id ?? '');
  const name = String(raw.name ?? '');
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const category = String(raw.category ?? 'transport') as CriticalFacility['category'];
  return {
    id,
    name,
    category: ['fire', 'medical', 'school', 'shelter', 'utility', 'transport'].includes(category)
      ? category
      : 'transport',
    lat,
    lon,
    county: String(raw.county ?? ''),
    notes: String(raw.notes ?? ''),
    corridorExposure: Math.min(1, Math.max(0, Number(raw.corridorExposure) || 0.5)),
  };
}

export async function loadCriticalFacilitiesCatalog(
  url = `${import.meta.env.BASE_URL}data/critical-facilities-posey-screening.json`,
): Promise<CriticalFacilitiesCatalog> {
  if (cached) return cached;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      schema?: string;
      authorityClass?: string;
      source?: string;
      disclaimer?: string;
      retrievedAt?: string;
      features?: Record<string, unknown>[];
    };
    const features = (data.features ?? [])
      .map(mapFeature)
      .filter((f): f is CriticalFacility => f != null);
    cached = {
      schema: data.schema ?? 'tsm.critical-facilities.v1',
      authorityClass: data.authorityClass ?? 'SCREENING_INVENTORY',
      source: data.source ?? 'fallback',
      disclaimer: data.disclaimer ?? 'Screening only.',
      retrievedAt: data.retrievedAt ?? new Date().toISOString(),
      features: features.length > 0 ? features : [...SCREENING_CRITICAL_FACILITIES],
    };
    return cached;
  } catch {
    cached = {
      schema: 'tsm.critical-facilities.v1',
      authorityClass: 'SCREENING_INVENTORY',
      source: 'builtin-SCREENING_CRITICAL_FACILITIES',
      disclaimer: 'Catalog fetch failed; using built-in screening pins.',
      retrievedAt: new Date().toISOString(),
      features: [...SCREENING_CRITICAL_FACILITIES],
    };
    return cached;
  }
}
