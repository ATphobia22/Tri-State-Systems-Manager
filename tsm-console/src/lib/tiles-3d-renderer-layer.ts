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
 * - 5D state-word (uint16) carried via EXT_structural_metadata per feature
 *
 * Resilient design: the layer normalizes tileset URLs and always attempts
 * to render. Problems are logged with recovery info; only javascript:/data:
 * URLs are rejected (genuine XSS risk). Loader failures are contained and
 * the layer keeps rendering whatever loaded successfully.
 */

import * as maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import { MapScene } from '@dvt3d/maplibre-three-plugin';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Published 16-bit B-D-C-T-S layout:
 * B[15:14], D[13:12], C[11:9], T[8:6], S[5:3], R[2:0].
 * B/D use two bits; C/T/S use three storage bits but levels 4-7 are reserved
 * and rejected until explicitly registered by a versioned TSM contract.
 */
export const STATE_WORD_BITS = {
  B: { offset: 14, mask: 0x3 }, // Boundary proxy: 0-3
  D: { offset: 12, mask: 0x3 }, // Geometric detail: 0-3
  C: { offset: 9, mask: 0x7 },  // Component complexity: valid levels 0-3
  T: { offset: 6, mask: 0x7 },  // Texture appearance: valid levels 0-3
  S: { offset: 3, mask: 0x7 },  // Semantic depth: valid levels 0-3
} as const;

export const STATE_WORD_EXTENSION_BITS = { offset: 0, mask: 0x7 } as const;
export type StateWordDimension = keyof typeof STATE_WORD_BITS;
export type StateWordValues = Record<StateWordDimension, number>;

/** Validate the unsigned 16-bit storage boundary before bitwise operations. */
export function assertStateWord(word: number): void {
  if (!Number.isInteger(word) || word < 0 || word > 0xffff) {
    throw new RangeError(`State word must be an unsigned 16-bit integer; received ${word}`);
  }
}

/** Reject reserved B-D-C-T-S levels before the word enters scheduling. */
export function assertValidStateWord(word: number): void {
  assertStateWord(word);
  for (const dim of Object.keys(STATE_WORD_BITS) as StateWordDimension[]) {
    const { offset, mask } = STATE_WORD_BITS[dim];
    const value = (word >>> offset) & mask;
    if (value > 3) throw new RangeError(`Reserved ${dim} state-word level: ${value}`);
  }
  const extension = (word >>> STATE_WORD_EXTENSION_BITS.offset) & STATE_WORD_EXTENSION_BITS.mask;
  if (extension > 1) throw new RangeError(`Reserved R extension value: ${extension}`);
}

/** Encode a valid B-D-C-T-S state and the three-bit R extension field. */
export function encodeStateWord(values: StateWordValues, extension = 0): number {
  if (!Number.isInteger(extension) || extension < 0 || extension > 1) {
    throw new RangeError(`R extension must be 0 or 1 in the current schema; received ${extension}`);
  }
  let word = extension;
  for (const dim of Object.keys(STATE_WORD_BITS) as StateWordDimension[]) {
    const { offset } = STATE_WORD_BITS[dim];
    const value = values[dim];
    if (!Number.isInteger(value) || value < 0 || value > 3) {
      throw new RangeError(`${dim} must be an integer in [0, 3]; received ${value}`);
    }
    word |= value << offset;
  }
  return word;
}

/** Decode one dimension from a valid 16-bit state word. O(1) bitwise operation. */
export function decodeStateWord(word: number, dim: StateWordDimension): number {
  assertValidStateWord(word);
  const bits = STATE_WORD_BITS[dim];
  if (!bits) throw new RangeError(`Unknown state-word dimension: ${String(dim)}`);
  return (word >>> bits.offset) & bits.mask;
}

/** Decode the three-bit R extension field (not one of the five dimensions). */
export function decodeStateWordExtension(word: number): number {
  assertValidStateWord(word);
  return (word >>> STATE_WORD_EXTENSION_BITS.offset) & STATE_WORD_EXTENSION_BITS.mask;
}

/** XOR-diff two words; a non-zero result may indicate dimension and/or R changes. */
export function diffStateWords(prev: number, next: number): number {
  assertValidStateWord(prev);
  assertValidStateWord(next);
  return prev ^ next;
}

/** Check whether one B-D-C-T-S dimension changed between two valid state words. */
export function didDimensionChange(prev: number, next: number, dim: StateWordDimension): boolean {
  assertValidStateWord(prev);
  assertValidStateWord(next);
  const bits = STATE_WORD_BITS[dim];
  if (!bits) throw new RangeError(`Unknown state-word dimension: ${String(dim)}`);
  return (((prev ^ next) >>> bits.offset) & bits.mask) !== 0;
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
      this.tilesRenderer = new TilesRenderer(url);
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
