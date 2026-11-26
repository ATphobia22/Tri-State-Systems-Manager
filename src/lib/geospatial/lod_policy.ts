/**
 * Levels of Detail (LoD) policy for TSM / Auto-3D City Builder.
 * Aligns CityGML LoD0–3, 3D Tiles geometric error, and Unreal HLOD.
 */
export type CityGmlLod = 0 | 1 | 2 | 3 | 4;
export type HeightSource = 'OBSERVED' | 'DERIVED' | 'INTERPOLATED' | 'UNKNOWN';

export interface BuildingLodRecord {
  featureId: string;
  lod: CityGmlLod;
  heightSource: HeightSource;
  heightM?: number;
  hasOpenings: boolean;
  hasTextures: boolean;
  geometricErrorM: number;
  allowClashSolid: boolean;
}

export const CITYGML_LOD: Record<CityGmlLod, string> = {
  0: 'Footprint / roof edge 2.5D',
  1: 'Block model extruded solid',
  2: 'Roof structure (hip/gable/flat)',
  3: 'Exterior openings + architectural detail',
  4: 'Interior rooms (optional; not default public twin)',
};

export const TILES_GEOMETRIC_ERROR: Record<string, number> = {
  region: 500,
  city: 80,
  district: 20,
  block: 5,
  building_lod1: 2,
  building_lod2: 0.5,
  building_lod3: 0.15,
  street_furniture: 0.1,
};

export const UNREAL_HLOD = {
  cellSizeM: { core: 128, fringe: 512 },
  dataLayers: [
    'Terrain', 'Buildings_LoD1', 'Buildings_LoD2', 'Buildings_LoD3',
    'Roads', 'Utilities_Public', 'Flood_Overlays', 'Sim_SDF_Deltas',
  ],
};

export function classifyBuildingLod(input: {
  hasFootprint: boolean;
  heightM?: number;
  heightSource?: HeightSource;
  hasRoofStructure?: boolean;
  hasOpenings?: boolean;
  hasTextures?: boolean;
}): BuildingLodRecord {
  let lod: CityGmlLod = 0;
  if (input.hasFootprint && input.heightM != null && input.heightM > 0) lod = 1;
  if (lod >= 1 && input.hasRoofStructure) lod = 2;
  if (lod >= 2 && input.hasOpenings) lod = 3;
  const heightSource = input.heightSource ?? (input.heightM != null ? 'DERIVED' : 'UNKNOWN');
  const geometricErrorM =
    lod >= 3 ? TILES_GEOMETRIC_ERROR.building_lod3
    : lod === 2 ? TILES_GEOMETRIC_ERROR.building_lod2
    : lod === 1 ? TILES_GEOMETRIC_ERROR.building_lod1
    : TILES_GEOMETRIC_ERROR.block;
  return {
    featureId: '',
    lod,
    heightSource,
    heightM: input.heightM,
    hasOpenings: !!input.hasOpenings,
    hasTextures: !!input.hasTextures,
    geometricErrorM,
    allowClashSolid: heightSource === 'OBSERVED' && lod >= 1,
  };
}

export function regulatoryViewLod(): CityGmlLod { return 2; }
export function publicTilesetLodCap(): CityGmlLod { return 3; }
