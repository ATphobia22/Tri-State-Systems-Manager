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
import { TilesRenderer } from '3d-tiles-renderer';
import { GLTFExtensionsPlugin } from '3d-tiles-renderer/plugins';
import { MapScene } from '@dvt3d/maplibre-three-plugin';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { STATE_WORD_BITS, assertValidStateWord, decodeStateWord } from './state-word-codec';
import { decodeFeatureStateWord, type MeshFeaturesReader, type StructuralMetadataReader } from './state-word-metadata';
import { WebGL2DepthOcclusionController } from './webgl2-depth-occlusion';
import { AdaptiveSseBudget } from './adaptive-sse-budget';

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
    /_*FEATURE_*ID_*0$/i.test(name),
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
  try {
    return decodeFeatureStateWord(metadata, features, featureId);
  } catch {
    // Broken or reserved metadata must not break ordinary asset rendering.
    return null;
  }
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
  private occlusion: WebGL2DepthOcclusionController | null = null;
  private readonly stateWordMeshes = new Map<THREE.Mesh, ManagedStateWordMesh>();
  private lastFrameTimestamp = 0;
  private smoothedFrameTimeMs: number | null = null;
  private readonly adaptiveSseBudget: AdaptiveSseBudget;
  private readonly config: Required<Omit<Tiles3DRendererLayerConfig, 'id' | 'tilesetUrl'>> &
    Pick<Tiles3DRendererLayerConfig, 'id' | 'tilesetUrl'>;

  constructor(config: Tiles3DRendererLayerConfig) {
    this.id = config.id;
    this.config = {
      ...config,
      enableIBL: config.enableIBL ?? true,
      iblIntensity: config.iblIntensity ?? 1.0,
      maxSse: config.maxSse ?? 16,
      minFps: config.minFps ?? 30,
      fpsRecoveryMargin: config.fpsRecoveryMargin ?? 8,
    };
    if (!Number.isFinite(this.config.minFps) || this.config.minFps <= 0) {
      throw new RangeError('minFps must be a finite number greater than zero');
    }
    if (!Number.isFinite(this.config.fpsRecoveryMargin) || this.config.fpsRecoveryMargin < 0) {
      throw new RangeError('fpsRecoveryMargin must be a finite non-negative number');
    }
    this.adaptiveSseBudget = new AdaptiveSseBudget({
      baseSse: this.config.maxSse,
      minFps: this.config.minFps,
      recoveryFps: this.config.minFps + this.config.fpsRecoveryMargin,
    });
  }

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext): void {
    const url = normalizeTilesetUrl(this.config.tilesetUrl);
    if (url === null) {
      console.warn(`[Tiles3D] Rejected unsafe tileset URL: ${this.config.tilesetUrl}`);
      return;
    }
    if (url !== this.config.tilesetUrl) {
      console.info(`[Tiles3D] Normalized tileset URL: ${this.config.tilesetUrl} -> ${url}`);
    }
    try {
      this.mapScene = new MapScene(map as never, { enablePostProcessing: false });
      const scene = this.mapScene.scene as THREE.Scene;

      if (this.config.enableIBL) {
        const renderer = this.mapScene.renderer as THREE.WebGLRenderer;
        this.pmrem = new THREE.PMREMGenerator(renderer);
        const envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = envTex;
        scene.environmentIntensity = this.config.iblIntensity;
      }

      // Register the official loader extensions for 3D Tiles 1.1. Without this
      // plugin, EXT_mesh_features and EXT_structural_metadata stay unbound.
      const tilesRenderer = new TilesRenderer(url);
      tilesRenderer.errorTarget = this.config.maxSse;

      // Occlusion queries use the WebGL2 depth buffer MapLibre has already
      // populated. If the host did not supply a WebGL2 context, rendering
      // remains functional without this optional optimization.
      try {
        this.occlusion = new WebGL2DepthOcclusionController(gl as WebGL2RenderingContext, {
          maxQueriesPerFrame: 64,
          consecutiveOccludedFrames: 2,
        });
      } catch (error) {
        console.warn('[Tiles3D] WebGL2 depth occlusion unavailable; using conservative visibility:', error);
        this.occlusion = null;
      }

      tilesRenderer.registerPlugin(new GLTFExtensionsPlugin({ metadata: true, rtc: false }));
      tilesRenderer.addEventListener('load-model', (event: { scene: THREE.Object3D }) => {
        this.occlusion?.registerRoot(event.scene);
        this.attachStateWords(event.scene);
      });
      tilesRenderer.addEventListener('dispose-model', (event: { scene: THREE.Object3D }) => {
        this.occlusion?.unregisterRoot(event.scene, (mesh) => this.shouldMeshBeVisible(mesh));
        this.detachStateWords(event.scene);
      });
      this.tilesRenderer = tilesRenderer;
      scene.add(tilesRenderer.group as unknown as THREE.Object3D);
    } catch (error) {
      console.warn('[Tiles3D] Failed to initialize layer:', error);
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
      const camera = ms?.camera;
      if (this.tilesRenderer && camera && ms?.renderer) {
        camera.updateMatrixWorld(true);
        this.tilesRenderer.setCamera(camera);
        this.tilesRenderer.setResolutionFromRenderer(camera, ms.renderer);
        // NASA-AMMOS 3D Tiles Renderer already owns hierarchy traversal, frustum
        // rejection, and screen-space-error refinement. Adapt its real refinement
        // threshold instead of adding a duplicate culler beside the live tileset.
        this.tilesRenderer.errorTarget = this.adaptiveSseBudget.update(
          this.smoothedFrameTimeMs === null ? null : 1000 / this.smoothedFrameTimeMs,
        );
        this.tilesRenderer.update();
        this.tilesRenderer.group.updateMatrixWorld(true);
        if (this.occlusion) {
          this.occlusion.update(camera, (mesh) => this.shouldMeshBeVisible(mesh));
          // Raw WebGL2 queries adjust GL state directly. Invalidate Three.js'
          // state cache before MapScene performs its normal render.
          ms.renderer.resetState();
        }
      }
      ms?.render?.();
    } catch (error) {
      console.warn('[Tiles3D] Render error (suppressed):', error);
    }
  }

  onRemove(): void {
    // Remove queries first, restoring computed state, then restore source
    // material/visibility as the final lifecycle cleanup step.
    this.occlusion?.dispose((mesh) => this.shouldMeshBeVisible(mesh));
    this.occlusion = null;
    for (const [mesh, managed] of this.stateWordMeshes) {
      this.restoreManagedMesh(mesh, managed);
    }
    this.stateWordMeshes.clear();
    try {
      this.tilesRenderer?.dispose();
      this.pmrem?.dispose();
      (this.mapScene?.scene as THREE.Scene | undefined)?.environment?.dispose?.();
    } catch {
      /* ignore teardown errors */
    }
    this.lastFrameTimestamp = 0;
    this.smoothedFrameTimeMs = null;
    this.adaptiveSseBudget.reset();
    this.tilesRenderer = null;
    this.mapScene = null;
    this.pmrem = null;
  }

  private attachStateWords(root: THREE.Object3D): void {
    let count = 0;
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || this.stateWordMeshes.has(object)) return;
      try {
        const stateWord = readStateWordFromMesh(object);
        if (stateWord === null) return;
        const originalMaterial = object.material;
        const originalMaterials = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];
        // Per-mesh clones are required: the loader may share one Material across
        // features with different state words, and per-feature degradation must
        // never mutate another feature's original material.
        const clonedMaterials = originalMaterials.map((material) => material.clone());
        object.material = Array.isArray(originalMaterial) ? clonedMaterials : clonedMaterials[0];
        const managed: ManagedStateWordMesh = {
          baseWord: stateWord,
          currentWord: stateWord,
          originalMaterial,
          originalMaterials,
          clonedMaterials,
          originalVisible: object.visible,
          isBoundaryProxy: object.userData.tsmBoundaryProxy === true,
          componentLevel: object.userData.tsmOptionalComponent === true
            ? asOptionalLevel(object.userData.tsmComponentLevel)
            : null,
          semanticLevel: object.userData.tsmSemanticOverlay === true
            ? asOptionalLevel(object.userData.tsmSemanticLevel)
            : null,
          semanticOverlay: object.userData.tsmSemanticOverlay === true,
        };
        this.stateWordMeshes.set(object, managed);
        object.userData.tsmStateWord = stateWord;
        this.applyStateWord(object, managed);
        count++;
      } catch (error) {
        console.warn('[Tiles3D] Skipping invalid state-word metadata for one feature:', error);
      }
    });
    if (count > 0) console.info(`[Tiles3D] Bound validated stateWord metadata to ${count} feature mesh(es)`);
  }

  private detachStateWords(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const managed = this.stateWordMeshes.get(object);
      if (!managed) return;
      this.restoreManagedMesh(object, managed);
      this.stateWordMeshes.delete(object);
    });
  }

  private restoreManagedMesh(mesh: THREE.Mesh, managed: ManagedStateWordMesh): void {
    mesh.material = managed.originalMaterial;
    mesh.visible = managed.originalVisible;
    delete mesh.userData.tsmStateWord;
    delete mesh.userData.tsmEffectiveStateWord;
    for (const material of managed.clonedMaterials) material.dispose();
  }

  private shouldMeshBeVisible(mesh: THREE.Mesh): boolean {
    const managed = this.stateWordMeshes.get(mesh);
    if (!managed) return this.occlusion?.baseVisible(mesh) ?? mesh.visible;

    let visible = managed.originalVisible;
    if (!managed.isBoundaryProxy && managed.componentLevel !== null) {
      visible = visible && managed.componentLevel <= decodeStateWord(managed.currentWord, 'C');
    }
    if (!managed.isBoundaryProxy && managed.semanticOverlay && managed.semanticLevel !== null) {
      visible = visible && managed.semanticLevel <= decodeStateWord(managed.currentWord, 'S');
    }
    return visible;
  }

  private applyStateWord(mesh: THREE.Mesh, managed: ManagedStateWordMesh): void {
    const effectiveWord = managed.currentWord;
    const textureLevel = decodeStateWord(effectiveWord, 'T');
    managed.clonedMaterials.forEach((material, index) => {
      applyTextureLevel(managed.originalMaterials[index], material, textureLevel);
    });

    let visible = managed.originalVisible;
    if (!managed.isBoundaryProxy && managed.componentLevel !== null) {
      visible = visible && managed.componentLevel <= decodeStateWord(effectiveWord, 'C');
    }
    if (!managed.isBoundaryProxy && managed.semanticOverlay && managed.semanticLevel !== null) {
      visible = visible && managed.semanticLevel <= decodeStateWord(effectiveWord, 'S');
    }
    mesh.visible = visible && !(this.occlusion?.isOccluded(mesh) ?? false);
    mesh.userData.tsmStateWord = managed.baseWord;
    mesh.userData.tsmEffectiveStateWord = effectiveWord;
  }

  private updateFrameBudget(): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.lastFrameTimestamp > 0) {
      const deltaMs = now - this.lastFrameTimestamp;
      // Ignore background-tab pauses and invalid clock deltas.
      if (deltaMs >= 4 && deltaMs <= 250) {
        this.smoothedFrameTimeMs = this.smoothedFrameTimeMs === null
          ? deltaMs
          : this.smoothedFrameTimeMs * 0.85 + deltaMs * 0.15;
      }
      if (this.smoothedFrameTimeMs !== null && this.stateWordMeshes.size > 0) {
        const smoothedFps = 1000 / this.smoothedFrameTimeMs;
        for (const [mesh, managed] of this.stateWordMeshes) {
          const nextWord = stateWordForFrameBudget(
            managed.baseWord,
            managed.currentWord,
            smoothedFps,
            this.config.minFps,
            this.config.minFps + this.config.fpsRecoveryMargin,
          );
          if (nextWord === managed.currentWord) continue;
          managed.currentWord = nextWord;
          this.applyStateWord(mesh, managed);
        }
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
