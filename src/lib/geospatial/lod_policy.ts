export type CityGmlLod = 0 | 1 | 2 | 3 | 4;
export type HeightSource = 'OBSERVED' | 'DERIVED' | 'INTERPOLATED' | 'UNKNOWN';
export const TILES_GEOMETRIC_ERROR = { region: 500, city: 80, district: 20, block: 5, building_lod1: 2, building_lod2: 0.5, building_lod3: 0.15, street_furniture: 0.1 };
export const LOD3_PRECISION = { posHeightMaxM: 0.5, mlsRelativeCm: [1, 3] as [number, number], featureMinM_3_2: 1.0, featureMinM_3_3: 0.2, installationThicknessSolidM: 0.5 };
export type IndoorLodSublevel = '4.0' | '4.1' | '4.2';
export const LOD4_INDOOR = {
  '4.0': { rooms: true, intInstallations: false, furniture: false, description: 'Room solids only' },
  '4.1': { rooms: true, intInstallations: true, furniture: false, description: 'Rooms + stairs/elevators/columns' },
  '4.2': { rooms: true, intInstallations: true, furniture: true, description: 'Rooms + installations + furniture' },
};
export function publicTilesetLodCap(): CityGmlLod { return 3; }
export function publicAllowsIndoor(): boolean { return false; }
export function cityGml3IndoorAllowedOnShell(shellLod: CityGmlLod): boolean { return shellLod >= 0 && shellLod <= 3; }
export function validateLod3Openings(opts: { hasWindowsOrDoors: boolean; featureMinSizeM: number; source: 'MLS' | 'IFC' | 'PHOTOGRAMMETRY' | 'MANUAL' | 'NONE' }): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  if (!opts.hasWindowsOrDoors || opts.source === 'NONE') return { ok: false, notes: ['LoD3 requires openings + MLS/IFC/photogrammetry'] };
  if (opts.featureMinSizeM > LOD3_PRECISION.featureMinM_3_2) notes.push('LOD3.2-class openings only');
  return { ok: true, notes };
}
