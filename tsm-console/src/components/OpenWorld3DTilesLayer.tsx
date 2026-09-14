import { resolveThreeDTilesetUrl, type ThreeDTilesSource } from '../lib/martin-tile-fabric';

export interface OpenWorld3DTilesLayerProps {
  readonly source: ThreeDTilesSource;
  readonly role: 'photogrammetry' | 'buildings' | 'point-cloud' | 'bim-cad' | 'instanced-features';
}

/**
 * Renderer-facing OGC 3D Tiles contract.
 * The actual 3D renderer owns loading and visualization; TSM only exposes
 * a validated tileset URL and provenance role.
 */
export function OpenWorld3DTilesLayer({ source, role }: OpenWorld3DTilesLayerProps) {
  const tilesetUrl = resolveThreeDTilesetUrl(source);

  return (
    <div
      data-testid="open-world-3d-tiles-layer"
      data-source-id={source.id}
      data-role={role}
      data-tileset-url={tilesetUrl}
      aria-label={`3D Tiles source ${source.id}; role ${role}`}
    />
  );
}
