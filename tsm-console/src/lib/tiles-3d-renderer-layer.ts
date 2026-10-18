/**
 * tiles-3d-renderer-layer.ts — 3D Tiles 1.1 renderer for MapLibre GL JS.
 *
 * Integrates NASA JPL's 3d-tiles-renderer (Apache-2.0) with MapLibre via
 * @dvt3d/maplibre-three-plugin's MapScene. The renderer applies 3D Tiles tile
 * transforms and glTF node transforms; precision depends on the source frame
 * and the renderer's actual transform path.
 *
 * Coordinate safety:
 * - TSM's 3D Tiles 1.1 producers must emit explicit, validated transforms.
 * - Legacy RTC_CENTER handling must not be treated as a 3D Tiles 1.1 contract.
 * - Local ENU coordinates and control-point tolerances are validated in the
 *   geospatial build/test pipeline; this layer does not certify source CRS or datum.
 * - PBR/IBL via three.js PMREMGenerator + RoomEnvironment (procedural HDR)
 * - EXT_mesh_features / EXT_structural_metadata use the renderer's supported
 *   GLTFExtensionsPlugin; only valid StateWord rows drive presentation fallback.
 *
 * Resilient design: the layer normalizes tileset URLs and always attempts
 * to render. Problems are logged with recovery info; only javascript:/data:
 * URLs are rejected (genuine XSS risk). Loader failures are contained and
 * the layer keeps rendering whatever loaded successfully.
 */

import * as maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFExtensionsPlugin, TilesRenderer } from '3d-tiles-renderer';
import { MapScene } from '@dvt3d/maplibre-three-plugin';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  STATE_WORD_BITS,
  STATE_WORD_EXTENSION_BITS,
  assertStateWord,
  assertValidStateWord,
  decodeStateWord,
  decodeStateWordExtension,
  diffStateWords,
  didDimensionChange,
  encodeStateWord,
  type StateWordDimension,
  type StateWordValues,
} from './state-word-codec';
import { decodeFeatureStateWord, type MeshFeaturesReader, type StructuralMetadataReader } from './state-word-metadata';

export {
  STATE_WORD_BITS,
  STATE_WORD_EXTENSION_BITS,
  assertStateWord,
  assertValidStateWord,
  decodeStateWord,
  decodeStateWordExtension,
  diffStateWords,
  didDimensionChange,
  encodeStateWord,
} from './state-word-codec';
export type { StateWordDimension, StateWordValues } from './state-word-codec';

const TEXTURE_MAP_PROPERTIES = [
  'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap',
  'alphaMap', 'lightMap', 'bumpMap', 'displacementMap', 'clearcoatMap',
  'clearcoatNormalMap', 'clearcoatRoughnessMap', 'sheenColorMap',
  'sheenRoughnessMap', 'specularIntensityMap', 'specularColorMap',
  'transmissionMap', 'thicknessMap', 'iridescenceMap',
  'iridescenceThicknessMap', 'anisotropyMap',
] as const;

type TextureMapProperty = (typeof TEXTURE_MAP_PROPERTIES)[number];
type TextureBearingMaterial = THREE.Material & Partial<Record<TextureMapProperty, THREE.Texture | null>>;

interface ManagedStateWordMesh {
  baseWord: number;
  currentWord: number;
  originalMaterial: THREE.Material | THREE.Material[];
  originalMaterials: THREE.Material[];
  clonedMaterials: THREE.Material[];
  originalVisible: boolean;
  isBoundaryProxy: boolean;
  componentLevel: number | null;
  semanticLevel: number | null;
  semanticOverlay: boolean;
}

function readUniformFeatureId(mesh: THREE.Mesh): number | null {
  const entry = Object.entries(mesh.geometry.attributes).find(([name]) =>
    /_?FEATURE_?ID_?0$/i.test(name),
  );
  if (!entry) return null;
  const attribute = entry[1];
  if (attribute.count < 1) return null;
  const featureId = attribute.getX(0);
  if (!Number.isSafeInteger(featureId) || featureId < 0) return null;
  // Object-level state must not be applied to a primitive with mixed feature IDs.
  for (let i = 1; i < attribute.count; i++) {
    if (attribute.getX(i) !== featureId) return null;
  }
  return featureId;
}

function asOptionalLevel(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3
    ? value
    : null;
}

/** Clone materials per feature and drop only the channels permitted by T. */
function applyTextureLevel(source: THREE.Material, target: THREE.Material, level: number): void {
  const original = source as TextureBearingMaterial;
  const reduced = target as TextureBearingMaterial;
  const requiredLevel = (key: TextureMapProperty): number => {
    if (key === 'map') return 1;
    if (key === 'roughnessMap' || key === 'metalnessMap' || key === 'aoMap' || key === 'lightMap') return 2;
    if (key === 'alphaMap') return 0; // silhouette coverage is always preserved
    return 3;
  };
  for (const key of TEXTURE_MAP_PROPERTIES) {
    if (!(key in original)) continue;
    const channel = original[key];
    const next = level >= requiredLevel(key) ? (channel ?? null) : null;
    if (reduced[key] !== next) reduced[key] = next;
  }
  target.needsUpdate = true;
}

/** Reduce T, then C, then S; never alter boundary proxy B or geometric detail D. */
export function degradeStateWordOneStep(word: number): number {
  assertValidStateWord(word);
  for (const dimension of ['T', 'C', 'S'] as const) {
    const { offset, mask } = STATE_WORD_BITS[dimension];
    const current = (word >>> offset) & mask;
    if (current > 0) {
      const next = (word & ~(mask << offset)) | ((current - 1) << offset);
      assertValidStateWord(next);
      return next;
    }
  }
  return word;
}

function upgradeStateWordOneStep(currentWord: number, baseWord: number): number {
  assertValidStateWord(currentWord);
  assertValidStateWord(baseWord);
  // Reverse the degradation order so recovery restores semantics/components
  // before paying for richer textures again.
  for (const dimension of ['S', 'C', 'T'] as const) {
    const current = decodeStateWord(currentWord, dimension);
    const base = decodeStateWord(baseWord, dimension);
    if (current < base) {
      const { offset, mask } = STATE_WORD_BITS[dimension];
      const next = (currentWord & ~(mask << offset)) | ((current + 1) << offset);
      assertValidStateWord(next);
      return next;
    }
  }
  return currentWord;
}

/** Apply one-step degradation/recovery with FPS hysteresis. */
export function stateWordForFrameBudget(
  baseWord: number,
  currentWord: number,
  smoothedFps: number,
  minFps = 30,
  recoveryFps = 38,
): number {
  assertValidStateWord(baseWord);
  assertValidStateWord(currentWord);
  if (![smoothedFps, minFps, recoveryFps].every(Number.isFinite) ||
      smoothedFps < 0 || minFps <= 0 || recoveryFps < minFps) {
    throw new RangeError('frame-budget values must be finite, minFps > 0, and recoveryFps >= minFps');
  }
  if (smoothedFps < minFps) return degradeStateWordOneStep(currentWord);
  if (smoothedFps > recoveryFps) return upgradeStateWordOneStep(currentWord, baseWord);
  return currentWord;
}

/** Pull a stateWord only from a uniform feature-ID primitive and validated metadata. */
export function readStateWordFromMesh(mesh: THREE.Mesh): number | null {
  const features = mesh.userData.meshFeatures as MeshFeaturesReader | undefined;
  const metadata = mesh.userData.structuralMetadata as StructuralMetadataReader | undefined;
  if (!features || !metadata) return null;
  const featureId = readUniformFeatureId(mesh);
  if (featureId === null) return null;
  return decodeFeatureStateWord(metadata, features, featureId);
}

export interface Tiles3DRendererLayerConfig {
  id: string;
  /** Absolute http(s) URL or relative path to tileset.json */
  tilesetUrl: string;
  /** Enable PBR image-based lighting via procedural RoomEnvironment. Default true. */
  enableIBL?: boolean;
  /** IBL environment intensity. Default 1.0. */
  iblIntensity?: number;
  /** Maximum SSE (screen-space error) for refinement. Passed to renderer. */
  maxSse?: number;
  /** FPS below which feature material quality is reduced. Default 30. */
  minFps?: number;
  /** FPS recovery hysteresis above minFps. Default 8. */
  fpsRecoveryMargin?: number;
}

const isSafeUrl = (u: string): boolean =>
  /^(https?:\/\/|\.\.?\/|[^:/?#]+\/)/i.test(u) && !/^\s*javascript:/i.test(u);

/**
 * Normalize a tileset URL so the layer can work instead of refusing.
 * - Trims whitespace
 * - Resolves bare filenames against the app base path
 * - Returns null only for javascript:/data: URLs (genuine XSS risk)
 */
export function normalizeTilesetUrl(raw: string): string | null {
  const u = raw.trim();
  if (/^\s*javascript:/i.test(u) || /^\s*data:/i.test(u)) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/') || u.startsWith('./') || u.startsWith('../')) return u;
  // Bare filename or relative path: resolve against app base
  if (/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*(\.json)?$/i.test(u)) {
    return u.endsWith('.json') ? u : `${u}/tileset.json`;
  }
  return u;
}

/**
 * MapLibre custom layer hosting a 3d-tiles-renderer TilesRenderer.
 * Uses MapScene from the plugin for camera sync; RTC handled by the renderer.
 */
export class Tiles3DRendererLayer implements maplibregl.CustomLayerInterface {
  readonly id: string;
  readonly type: 'custom' = 'custom';
  readonly renderingMode: '3d' = '3d';

  private mapScene: MapScene | null = null;
  private tilesRenderer: TilesRenderer | null = null;
  private pmrem: THREE.PMREMGenerator | null = null;
  private readonly stateWordMeshes = new Map<THREE.Mesh, { baseWord: number; currentWord: number }>();
  private readonly originalTextureMaps = new WeakMap<THREE.Material, Map<TextureMapProperty, THREE.Texture | null>>();
  private lastFrameTimestamp = 0;
  private smoothedFrameTimeMs: number | null = null;
  private readonly config: Required<Omit<Tiles3DRendererLayerConfig, 'id' | 'tilesetUrl'>> &
    Pick<Tiles3DRendererLayerConfig, 'id' | 'tilesetUrl'>;

  constructor(config: Tiles3DRendererLayerConfig) {
    this.id = config.id;
    this.config = {
      ...config,
      enableIBL: config.enableIBL ?? true,
      iblIntensity: config.iblIntensity ?? 1.0,
      maxSse: config.maxSse ?? 16,
    };
  }

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext): void {
    // Resilient: normalize the URL and work with what we get instead of
    // refusing. Only javascript:/data: URLs are rejected (XSS risk).
    const url = normalizeTilesetUrl(this.config.tilesetUrl);
    if (url === null) {
      console.warn(`[Tiles3D] Rejected unsafe tileset URL: ${this.config.tilesetUrl}`);
      return;
    }
    if (url !== this.config.tilesetUrl) {
      console.info(`[Tiles3D] Normalized tileset URL: ${this.config.tilesetUrl} -> ${url}`);
    }
    try {
      // MapScene syncs the three.js camera with MapLibre's camera.
      this.mapScene = new MapScene(map as never, {
        enablePostProcessing: false,
      });

      const scene = this.mapScene.scene as THREE.Scene;

      // PBR image-based lighting: procedural RoomEnvironment, no external HDR.
      // Gives every PBR material (including GLTF-loaded) realistic ambient.
      if (this.config.enableIBL) {
        const renderer = this.mapScene.renderer as THREE.WebGLRenderer;
        this.pmrem = new THREE.PMREMGenerator(renderer);
        const envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = envTex;
        scene.environmentIntensity = this.config.iblIntensity;
      }

      // 3D Tiles renderer applies tile and glTF transforms. Do not assume
      // legacy RTC_CENTER metadata exists or supplies a valid local frame.
      const tilesRenderer = new TilesRenderer(url);
      tilesRenderer.errorTarget = this.config.maxSse;
      tilesRenderer.registerPlugin(new GLTFExtensionsPlugin({ metadata: true, rtc: true }));
      tilesRenderer.addEventListener('load-model', (event: { scene: THREE.Object3D }) => {
        this.attachStateWords(event.scene);
      });
      tilesRenderer.addEventListener('dispose-model', (event: { scene: THREE.Object3D }) => {
        this.detachStateWords(event.scene);
      });
      this.tilesRenderer = tilesRenderer;
      scene.add(tilesRenderer.group as unknown as THREE.Object3D);
    } catch (err) {
      console.warn('[Tiles3D] Failed to initialize layer:', err);
      this.mapScene = null;
      this.tilesRenderer = null;
    }
  }

  render(_gl: WebGLRenderingContext, _args: unknown): void {
    try {
      this.updateFrameBudget();
      const ms = this.mapScene as unknown as {
        cameraSync?: { syncCamera?: () => void };
        camera?: THREE.PerspectiveCamera;
        scene?: THREE.Scene;
        renderer?: THREE.WebGLRenderer;
        render?: () => void;
      } | null;
      ms?.cameraSync?.syncCamera?.();
      const cam = ms?.camera;
      if (this.tilesRenderer && cam && ms?.renderer) {
        this.tilesRenderer.setCamera(cam);
        this.tilesRenderer.setResolutionFromRenderer(cam, ms.renderer);
        this.tilesRenderer.update();
      }
      ms?.render?.();
    } catch (err) {
      console.warn('[Tiles3D] Render error (suppressed):', err);
    }
  }

  onRemove(): void {
    try {
      this.tilesRenderer?.dispose();
      this.pmrem?.dispose();
      (this.mapScene?.scene as THREE.Scene | undefined)?.environment?.dispose?.();
    } catch {
      /* ignore teardown errors */
    }
    for (const mesh of this.stateWordMeshes.keys()) this.setMeshTexturesEnabled(mesh, true);
    this.stateWordMeshes.clear();
    this.lastFrameTimestamp = 0;
    this.smoothedFrameTimeMs = null;
    this.tilesRenderer = null;
    this.mapScene = null;
    this.pmrem = null;
  }

  private attachStateWords(root: THREE.Object3D): void {
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh !== true) return;
      const stateWord = readStateWordFromMesh(mesh);
      if (stateWord === null) return;
      this.stateWordMeshes.set(mesh, { baseWord: stateWord, currentWord: stateWord });
      mesh.userData.tsmStateWord = stateWord;
      this.setMeshTexturesEnabled(mesh, decodeStateWord(stateWord, 'T') > 0);
    });
  }

  private detachStateWords(root: THREE.Object3D): void {
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh !== true || !this.stateWordMeshes.has(mesh)) return;
      this.setMeshTexturesEnabled(mesh, true);
      this.stateWordMeshes.delete(mesh);
      delete mesh.userData.tsmStateWord;
    });
  }

  private setMeshTexturesEnabled(mesh: THREE.Mesh, enabled: boolean): void {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const candidate = material as TextureBearingMaterial;
      let snapshot = this.originalTextureMaps.get(material);
      if (!snapshot) {
        snapshot = new Map<TextureMapProperty, THREE.Texture | null>();
        for (const key of TEXTURE_MAP_PROPERTIES) {
          const value = candidate[key];
          if (key in candidate && (value === null || value instanceof THREE.Texture)) {
            snapshot.set(key, value ?? null);
          }
        }
        this.originalTextureMaps.set(material, snapshot);
      }
      let changed = false;
      for (const [key, original] of snapshot) {
        const value = enabled ? original : null;
        if (candidate[key] !== value) {
          candidate[key] = value;
          changed = true;
        }
      }
      if (changed) material.needsUpdate = true;
    }
  }

  private updateFrameBudget(): void {
    const now = performance.now();
    if (this.lastFrameTimestamp > 0) {
      const delta = Math.min(250, Math.max(1, now - this.lastFrameTimestamp));
      this.smoothedFrameTimeMs = this.smoothedFrameTimeMs === null
        ? delta
        : this.smoothedFrameTimeMs * 0.85 + delta * 0.15;
      const smoothedFps = 1000 / this.smoothedFrameTimeMs;
      for (const [mesh, runtimeState] of this.stateWordMeshes) {
        const nextWord = stateWordForFrameBudget(runtimeState.baseWord, runtimeState.currentWord, smoothedFps);
        if (nextWord === runtimeState.currentWord) continue;
        runtimeState.currentWord = nextWord;
        mesh.userData.tsmStateWord = nextWord;
        this.setMeshTexturesEnabled(mesh, decodeStateWord(nextWord, 'T') > 0);
      }
    }
    this.lastFrameTimestamp = now;
  }
}

/**
 * GLSL chunk for the published 16-bit B-D-C-T-S state word.
 * Reads a per-instance `aStateWord` uint16 attribute; outputs b/d/c/t/s/r ints.
 *
 * Usage:
 *   shader.vertexShader = shader.vertexShader
 *     .replace('#include <common>', '#include <common>\nattribute uint aStateWord;\n...')
 */
export const STATE_WORD_GLSL_DECODE = /* glsl */ `
  // Published layout: B[15:14] D[13:12] C[11:9] T[8:6] S[5:3] R[2:0]
  uint _sw = aStateWord;
  int swB = int((_sw >> 14u) & 0x3u);
  int swD = int((_sw >> 12u) & 0x3u);
  int swC = int((_sw >> 9u) & 0x7u);
  int swT = int((_sw >> 6u) & 0x7u);
  int swS = int((_sw >> 3u) & 0x7u);
  int swR = int(_sw & 0x7u);
  // C/T/S levels 4-7 are reserved in the current contract.
  bool swValid = (swC <= 3) && (swT <= 3) && (swS <= 3) && (swR <= 1);
`;
