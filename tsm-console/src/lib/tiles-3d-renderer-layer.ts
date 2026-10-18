/**
 * tiles-3d-renderer-layer.ts — 3D Tiles 1.1 renderer for MapLibre GL JS.
 *
 * Integrates NASA JPL's 3d-tiles-renderer (Apache-2.0) with MapLibre via
 * @dvt3d/maplibre-three-plugin's MapScene, with RTC (Relative-To-Center)
 * coordinate handling for 32-bit float precision.
 *
 * Research basis: mapping-planes-lod-integration-20261018-0426
 * - 3D Tiles 1.1: RTC center in glTF root-node translation (double precision)
 * - Renderer handles double-precision internally; GPU sees only small relatives
 * - PBR/IBL via three.js PMREMGenerator + RoomEnvironment (procedural HDR)
 * - State-word helpers mirror the published B/D/C/T/S + reserved-R 16-bit layout.
 * - This layer does not yet parse EXT_structural_metadata or schedule feature chunks.
 *
 * Fail-closed: tileset URL must be absolute http(s) or relative path;
 * loader failures never propagate into the map render loop.
 */

import * as maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import { MapScene } from '@dvt3d/maplibre-three-plugin';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Published 16-bit layout from Zhang et al. (2026):
 * B[15:14], D[13:12], C[11:9], T[8:6], S[5:3], R[2:0].
 * R is an extension field, not a sixth representation dimension.
 * R bit 0 flags constraint-aware degradation; R bits 1-2 are reserved.
 */
export const STATE_WORD_BITS = {
  B: { offset: 14, mask: 0x3 }, // Boundary-based spatial proxy: 0-3
  D: { offset: 12, mask: 0x3 }, // Geometric detail: 0-3
  C: { offset: 9, mask: 0x7 },  // Component complexity: 0-3 defined; 4-7 reserved
  T: { offset: 6, mask: 0x7 },  // Texture appearance: 0-3 defined; 4-7 reserved
  S: { offset: 3, mask: 0x7 },  // Semantic information: 0-3 defined; 4-7 reserved
} as const;

export const STATE_WORD_R_BITS = {
  offset: 0,
  mask: 0x7,
  exceptionFlagMask: 0x1,
  reservedMask: 0x6,
} as const;

export const STATE_WORD_LEVEL_MAX = {
  B: 3,
  D: 3,
  C: 3,
  T: 3,
  S: 3,
} as const;

export type StateWordDimension = keyof typeof STATE_WORD_BITS;
export type StateWordValues = { [K in StateWordDimension]: number };

const STATE_WORD_DIMENSIONS: StateWordDimension[] = ['B', 'D', 'C', 'T', 'S'];

/** Reject malformed words and every unregistered level or reserved bit. */
export function assertValidStateWord(word: number): void {
  if (!Number.isInteger(word) || word < 0 || word > 0xffff) {
    throw new RangeError('State word must be an unsigned 16-bit integer.');
  }

  for (const dimension of STATE_WORD_DIMENSIONS) {
    const { offset, mask } = STATE_WORD_BITS[dimension];
    const level = (word >> offset) & mask;
    if (level > STATE_WORD_LEVEL_MAX[dimension]) {
      throw new RangeError(`State-word ${dimension} level ${level} is reserved in v1.`);
    }
  }

  const reserved = word & STATE_WORD_R_BITS.mask;
  if ((reserved & STATE_WORD_R_BITS.reservedMask) !== 0) {
    throw new RangeError('State-word R bits 1-2 are reserved in v1.');
  }
}

/** Return false rather than throw when checking untrusted input. */
export function isValidStateWord(word: number): boolean {
  try {
    assertValidStateWord(word);
    return true;
  } catch {
    return false;
  }
}

/** Build a valid state word from the five dimension levels. */
export function encodeStateWord(
  values: StateWordValues,
  options: { exceptionFlag?: boolean } = {},
): number {
  if (!values || typeof values !== 'object') {
    throw new TypeError('State-word values must be an object.');
  }
  if (options.exceptionFlag !== undefined && typeof options.exceptionFlag !== 'boolean') {
    throw new TypeError('exceptionFlag must be a boolean when provided.');
  }

  let word = 0;
  for (const dimension of STATE_WORD_DIMENSIONS) {
    const level = values[dimension];
    const max = STATE_WORD_LEVEL_MAX[dimension];
    if (!Number.isInteger(level) || level < 0 || level > max) {
      throw new RangeError(`State-word ${dimension} level must be an integer from 0 through ${max}.`);
    }
    const { offset } = STATE_WORD_BITS[dimension];
    word |= level << offset;
  }

  if (options.exceptionFlag) {
    word |= STATE_WORD_R_BITS.exceptionFlagMask;
  }
  assertValidStateWord(word);
  return word;
}

/** Read the R-field exception flag after validating the complete word. */
export function getStateWordExceptionFlag(word: number): boolean {
  assertValidStateWord(word);
  return (word & STATE_WORD_R_BITS.exceptionFlagMask) !== 0;
}

/**
 * Decode one dimension from a valid state word in O(1).
 * The word is validated as a whole so a reserved level cannot be partially used.
 */
export function decodeStateWord(word: number, dim: StateWordDimension): number {
  assertValidStateWord(word);
  const layout = STATE_WORD_BITS[dim];
  if (!layout) throw new RangeError(`Unknown state-word dimension: ${String(dim)}`);
  return (word >> layout.offset) & layout.mask;
}

/** XOR-diff two valid state words. Non-zero means at least one bit changed. */
export function diffStateWords(prev: number, next: number): number {
  assertValidStateWord(prev);
  assertValidStateWord(next);
  return prev ^ next;
}

/** Check whether one of the five representation dimensions changed. */
export function didDimensionChange(
  prev: number,
  next: number,
  dim: StateWordDimension,
): boolean {
  return decodeStateWord(prev, dim) !== decodeStateWord(next, dim);
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
}

const isSafeUrl = (u: string): boolean =>
  /^(https?:\/\/|\.\.?\/|[^:/?#]+\/)/i.test(u) && !/^\s*javascript:/i.test(u);

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
    if (!isSafeUrl(this.config.tilesetUrl)) {
      console.warn(`[Tiles3D] Refusing unsafe tileset URL: ${this.config.tilesetUrl}`);
      return;
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

      // 3D Tiles renderer. Handles RTC_CENTER / root-node translation
      // internally in double precision; GPU sees small relative positions.
      this.tilesRenderer = new TilesRenderer(this.config.tilesetUrl);
      this.tilesRenderer.errorTarget = this.config.maxSse;
      scene.add(this.tilesRenderer.group as unknown as THREE.Object3D);
    } catch (err) {
      console.warn('[Tiles3D] Failed to initialize layer:', err);
      this.mapScene = null;
      this.tilesRenderer = null;
    }
  }

  render(_gl: WebGLRenderingContext, _args: unknown): void {
    try {
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
    this.tilesRenderer = null;
    this.mapScene = null;
    this.pmrem = null;
  }
}

/**
 * GLSL chunk for 5D state-word decode in shaders. Include in onBeforeCompile.
 * Reads a per-instance `aStateWord` uint16 attribute; outputs b/d/c/t/s ints.
 *
 * Usage:
 *   shader.vertexShader = shader.vertexShader
 *     .replace('#include <common>', '#include <common>\nattribute uint aStateWord;\n...')
 */
export const STATE_WORD_GLSL_DECODE = /* glsl */ `
  // Published v1 layout: B[15:14], D[13:12], C[11:9], T[8:6], S[5:3], R[2:0].
  uint _sw = aStateWord;
  int swB = int((_sw >> 14u) & 0x3u);
  int swD = int((_sw >> 12u) & 0x3u);
  int swC = int((_sw >> 9u) & 0x7u);
  int swT = int((_sw >> 6u) & 0x7u);
  int swS = int((_sw >> 3u) & 0x7u);
  uint swR = _sw & 0x7u;
  int swRException = int(swR & 0x1u);
  bool swValid = (swC <= 3) && (swT <= 3) && (swS <= 3) && ((swR & 0x6u) == 0u);
`;
