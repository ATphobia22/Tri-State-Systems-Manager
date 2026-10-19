/**
 * In-repo mesh sources discovered on main (Posey buildings).
 * Authority: DERIVED / SIMULATION_DEMO — not regulatory.
 *
 * Inventory: ~4,628 GLBs under public/3d-tiles; GeoJSON screening 22,815 features.
 */

export interface MeshSourceEntry {
  id: string;
  /** Path relative to tsm-console public or repo root */
  path: string;
  /** URL path when served from Vite/Pages */
  publicUrl: string;
  kind: 'glb' | 'tileset' | 'geojson';
  authority: 'DERIVED' | 'SIMULATION_DEMO';
  notes: string;
}

/** Curated pilots — small GLBs first for Nanite smoke. */
export const MESH_CATALOG: readonly MeshSourceEntry[] = Object.freeze([
  {
    id: 'buildings-lidar-12450-3-3-0',
    path: 'tsm-console/public/3d-tiles/buildings-lidar-12450/content/3/3/0.glb',
    publicUrl: '/3d-tiles/buildings-lidar-12450/content/3/3/0.glb',
    kind: 'glb',
    authority: 'DERIVED',
    notes: 'Small LiDAR building tile (~1.7KB, 36 non-indexed verts) — preferred smoke pilot',
  },
  {
    id: 'buildings-lidar-12450-3-0-4',
    path: 'tsm-console/public/3d-tiles/buildings-lidar-12450/content/3/0/4.glb',
    publicUrl: '/3d-tiles/buildings-lidar-12450/content/3/0/4.glb',
    kind: 'glb',
    authority: 'DERIVED',
    notes: 'Small building tile (~2.3KB)',
  },
  {
    id: 'buildings-lidar-12450-tileset',
    path: 'tsm-console/public/3d-tiles/buildings-lidar-12450/tileset.json',
    publicUrl: '/3d-tiles/buildings-lidar-12450/tileset.json',
    kind: 'tileset',
    authority: 'DERIVED',
    notes: '3D Tiles root for LiDAR building subset',
  },
  {
    id: 'buildings-3d-geojson',
    path: 'tsm-console/public/3d-tiles/buildings-3d.json',
    publicUrl: '/3d-tiles/buildings-3d.json',
    kind: 'geojson',
    authority: 'DERIVED',
    notes: '22,815 screening features with height_m — MapLibre extrusion, not meshlets',
  },
]);

export const DEFAULT_MESHLET_PILOT_ID = 'buildings-lidar-12450-3-3-0';

export function getMeshSource(id: string): MeshSourceEntry | undefined {
  return MESH_CATALOG.find((e) => e.id === id);
}

export function listGlbPilots(): MeshSourceEntry[] {
  return MESH_CATALOG.filter((e) => e.kind === 'glb');
}
