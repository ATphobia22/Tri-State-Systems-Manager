/**
 * Nanite plane B runtime — device, camera, pyramid, real GLB meshlets.
 * SIMULATION_DEMO / DERIVED only — never MapLibre regulatory substitute.
 */

import { buildDepthPyramidCpu } from './depth-pyramid';
import { mapLibreCameraToWebGpu, type MapLibreCameraState } from './maplibre-webgpu-camera';
import { DEFAULT_MESHLET_PILOT_ID, getMeshSource } from './mesh-catalog';
import { cullMeshlets } from './meshlet-cull';
import { buildMeshletsGreedy, createUnitCubeMesh } from './meshlet-import';
import { meshletsFromDefaultPilot } from './meshlet-from-glb';
import type { MeshletImportResult } from './meshlet-types';
import {
  isNanitePlaneEnabled,
  requestTsmWebGpuDevice,
  snapshotLimits,
  type WebGpuSupport,
} from './webgpu-device';

export type NanitePlaneStatus =
  | { phase: 'disabled' }
  | { phase: 'unsupported'; reason: string }
  | {
      phase: 'ready';
      limits: Record<string, number>;
      features: string[];
      pyramidLevels: number;
      cameraDistanceM: number;
      meshlets: {
        sourceId: string;
        count: number;
        triangles: number;
        visible: number;
        culled: number;
        warnings: string[];
      };
      label: 'SIMULATION_DEMO';
    };

export interface NaniteSmokeInput {
  camera: MapLibreCameraState;
  depthProxy?: { data: Float32Array; width: number; height: number };
}

let cachedDevice: WebGpuSupport | null = null;

export async function probeNanitePlane(): Promise<WebGpuSupport | { ok: false; reason: string }> {
  if (!isNanitePlaneEnabled()) {
    return { ok: false, reason: 'VITE_TSM_WEBGPU_NANITE not enabled' };
  }
  if (cachedDevice?.ok) return cachedDevice;
  cachedDevice = await requestTsmWebGpuDevice({ preferLargeStorage: true });
  return cachedDevice;
}

async function loadPilotMeshlets(): Promise<MeshletImportResult> {
  try {
    return await meshletsFromDefaultPilot();
  } catch (e) {
    const fallback = buildMeshletsGreedy(createUnitCubeMesh('tsm-smoke-cube-fallback'));
    fallback.warnings.push(
      `GLB pilot fetch failed (${e instanceof Error ? e.message : String(e)}); using unit cube`,
    );
    return fallback;
  }
}

export async function runNanitePlaneSmoke(input: NaniteSmokeInput): Promise<NanitePlaneStatus> {
  if (!isNanitePlaneEnabled()) {
    return { phase: 'disabled' };
  }

  const cam = mapLibreCameraToWebGpu(input.camera);
  const probe = await probeNanitePlane();

  const width = input.depthProxy?.width ?? 64;
  const height = input.depthProxy?.height ?? 64;
  let depth = input.depthProxy?.data;
  if (!depth) {
    depth = new Float32Array(width * height);
    for (let i = 0; i < depth.length; i++) depth[i] = (i % width) / width;
  }
  const pyramid = buildDepthPyramidCpu(depth, width, height);

  const imported = await loadPilotMeshlets();
  const cull = cullMeshlets(imported.pack, cam);
  const pilot = getMeshSource(DEFAULT_MESHLET_PILOT_ID);

  if (!probe.ok) {
    return { phase: 'unsupported', reason: probe.reason };
  }

  return {
    phase: 'ready',
    limits: snapshotLimits(probe.limits),
    features: probe.features,
    pyramidLevels: pyramid.levels.length,
    cameraDistanceM: cam.distanceM,
    meshlets: {
      sourceId: imported.pack.sourceId,
      count: imported.meshletCount,
      triangles: imported.triangleCount,
      visible: cull.visible.length,
      culled: cull.culled,
      warnings: [
        ...imported.warnings,
        pilot ? `catalog: ${pilot.publicUrl}` : 'catalog pilot missing',
      ],
    },
    label: 'SIMULATION_DEMO',
  };
}

export function resetNanitePlaneCache(): void {
  if (cachedDevice?.ok) {
    try {
      cachedDevice.device.destroy();
    } catch {
      /* already lost */
    }
  }
  cachedDevice = null;
}
