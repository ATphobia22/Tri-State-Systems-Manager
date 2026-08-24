import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { createOrthophotoTexture } from './orthophoto-texture';
import { sampleTerrainGrid, type TerrainGrid } from './terrain-grid';
import { decodeTerrainGeoTiff } from './terrain-raster';

export const POSEY_DISPLAY_SCALE = 0.08;

export interface PoseyTerrainState {
  readonly grid: TerrainGrid;
  readonly elevationOriginFt: number;
  readonly orthophotoTexture: THREE.Texture;
}

function createTerrainGeometry(grid: TerrainGrid, elevationOriginFt: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(grid.width * grid.height * 3);
  const uvs = new Float32Array(grid.width * grid.height * 2);
  const widthFt = grid.bounds[2] - grid.bounds[0];
  const depthFt = grid.bounds[3] - grid.bounds[1];

  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const index = y * grid.width + x;
      const offset = index * 3;
      positions[offset] = ((x / (grid.width - 1)) - 0.5) * widthFt * POSEY_DISPLAY_SCALE;
      positions[offset + 1] = (grid.elevations[index] - elevationOriginFt) * POSEY_DISPLAY_SCALE;
      positions[offset + 2] = (0.5 - (y / (grid.height - 1))) * depthFt * POSEY_DISPLAY_SCALE;
      uvs[index * 2] = x / (grid.width - 1);
      uvs[index * 2 + 1] = 1 - y / (grid.height - 1);
    }
  }

  const indices: number[] = [];
  for (let y = 0; y < grid.height - 1; y += 1) {
    for (let x = 0; x < grid.width - 1; x += 1) {
      const a = y * grid.width + x;
      const b = a + 1;
      const c = a + grid.width;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function PoseyTerrainMesh({
  onLoaded,
  onError,
}: {
  onLoaded: (state: PoseyTerrainState) => void;
  onError: (error: Error) => void;
}) {
  const [state, setState] = useState<PoseyTerrainState | null>(null);

  useEffect(() => {
    let cancelled = false;
    let texture: THREE.Texture | null = null;

    async function load() {
      try {
        const bounds = '2680000,940000,2685000,945000';
        const terrainResponse = await fetch(`/api/geospatial/posey/raster?kind=terrain&bbox=${bounds}&width=128&height=128`);
        if (!terrainResponse.ok) throw new Error(`Terrain request failed: HTTP ${terrainResponse.status}`);
        const terrainBuffer = await terrainResponse.arrayBuffer();
        const terrainRaster = await decodeTerrainGeoTiff(terrainBuffer);
        const grid = sampleTerrainGrid(terrainRaster, 128, 128);
        const orthophotoResponse = await fetch(`/api/geospatial/posey/raster?kind=orthophoto&bbox=${bounds}&width=2048&height=2048`);
        texture = await createOrthophotoTexture(orthophotoResponse);
        const minElevation = Math.min(...grid.elevations);
        const nextState: PoseyTerrainState = {
          grid,
          elevationOriginFt: Math.floor(minElevation),
          orthophotoTexture: texture,
        };
        if (cancelled) {
          texture.dispose();
          return;
        }
        setState(nextState);
        onLoaded(nextState);
      } catch (error) {
        if (!cancelled) onError(error instanceof Error ? error : new Error(String(error)));
      }
    }

    void load();
    return () => {
      cancelled = true;
      texture?.dispose();
    };
  }, [onError, onLoaded]);

  if (!state) return null;
  const geometry = createTerrainGeometry(state.grid, state.elevationOriginFt);
  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial map={state.orthophotoTexture} roughness={0.92} metalness={0} />
    </mesh>
  );
}
