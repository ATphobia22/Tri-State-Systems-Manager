export type LocalDamFeature = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  county: string;
  state: string;
  ownerType: string;
  primaryPurpose: string;
  hazardPotential: string;
  condition: string;
  height_ft: number | null;
  maxStorage_acft: number | null;
  authorityClass: 'OBSERVED_REGISTRY';
  notes: string;
  relatedGageUsgs?: string;
  relatedGageNws?: string;
};

export type LocalDamsCatalog = {
  schema: string;
  authorityClass: string;
  source: string;
  disclaimer: string;
  aoi: string;
  features: LocalDamFeature[];
};

let cached: LocalDamsCatalog | null = null;

export async function loadLocalDamsCatalog(
  url = `${import.meta.env.BASE_URL}data/local-dams-posey.json`,
): Promise<LocalDamsCatalog> {
  if (cached) return cached;
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Local dams catalog unavailable (${res.status})`);
  const data = (await res.json()) as LocalDamsCatalog;
  if (!data?.features?.length) throw new Error('Local dams catalog empty');
  cached = data;
  return data;
}

export function damsToGeoJson(catalog: LocalDamsCatalog): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: catalog.features.map((d) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
      properties: {
        id: d.id,
        name: d.name,
        hazardPotential: d.hazardPotential,
        condition: d.condition,
        ownerType: d.ownerType,
        primaryPurpose: d.primaryPurpose,
        height_ft: d.height_ft,
        maxStorage_acft: d.maxStorage_acft,
        authorityClass: d.authorityClass,
        notes: d.notes,
      },
    })),
  };
}
