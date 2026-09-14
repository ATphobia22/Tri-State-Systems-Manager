import { resolveOpenWorldSources, type GeospatialTileManifest } from './geospatial-tile-resolver';
import type { ResolvedTileSource } from './geospatial-tile-sources';

export const OPEN_WORLD_OVERLAY_IDS = [
  'fema-effective',
  'indiana-bafm',
  'indiana-parcels-2025',
  'usace-nld',
] as const;

export function getOpenWorldOverlaySources(
  manifest: GeospatialTileManifest,
  now = new Date(),
): readonly ResolvedTileSource[] {
  return resolveOpenWorldSources(manifest, OPEN_WORLD_OVERLAY_IDS, now);
}
