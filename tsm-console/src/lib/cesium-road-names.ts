/**
 * Cesium road-name labels from the generated TIGER/Line 2024 archive.
 * A label exists only where TIGER records a FULLNAME; unnamed centerlines
 * never produce one and no name is invented. Tier major is MTFCC S1100/S1200
 * on the seed segment; everything else named is local. Three Posey County
 * labels show an agreed display name instead of the TIGER FULLNAME (user
 * decision 2026-11-19: OSM + IndianaMap agree against TIGER); the TIGER
 * name is kept in the label's tiger_name property.
 */

export type RoadNameTier = 'major' | 'local';
export type RoadNameLabel = { name: string; lon: number; lat: number; tier: RoadNameTier };

export function parseRoadNames(data: unknown): RoadNameLabel[] {
  if (!data || typeof data !== 'object') throw new Error('Road-name archive is not an object');
  const archive = data as { metadata?: { labelCount?: unknown }; features?: unknown };
  if (!Array.isArray(archive.features)) throw new Error('Road-name archive has no features');
  if (archive.metadata?.labelCount !== archive.features.length) throw new Error('Road-name count mismatch');
  return archive.features.map((feature) => {
    const item = feature as GeoJSON.Feature;
    if (item.geometry?.type !== 'Point') throw new Error('Road-name feature is not a point');
    const [lon, lat] = item.geometry.coordinates;
    const name = String(item.properties?.name ?? '').trim();
    const tier = item.properties?.tier;
    if (!name || (tier !== 'major' && tier !== 'local') || !Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new Error('Road-name feature is incomplete');
    }
    return { name, lon, lat, tier };
  });
}
