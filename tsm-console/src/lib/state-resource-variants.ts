/**
 * state-resource-variants.ts — C/S state resource variants for TSM.
 *
 * Extends the 5D state-word system (state-word-scheduler.ts): where the
 * scheduler decides *which dimensions* change, this module maps a state
 * word to *concrete resource variant descriptors* — which geometry LOD,
 * which texture resolution, which components are active.
 *
 * This is the management/logic layer: manifests are descriptors (URLs,
 * byte sizes, LOD levels), not binary data. The caller performs the
 * actual network fetch and GPU upload.
 *
 * Dimension levels (per state-word-codec.ts): each of B/D/C/T/S is 0-3.
 */

import {
  assertValidStateWord,
  decodeStateWord,
  type StateWordDimension,
} from './state-word-codec';
import { chunksToFetch, chunksToRelease } from './state-word-scheduler';

/** Geometry LOD variant for dimension D. */
export interface GeometryVariant {
  /** LOD label, e.g. 'proxy' | 'lod1' | 'lod2' | 'lod2-detail'. */
  lod: string;
  /** Relative asset URL (resolved against the manager's base URL). */
  url: string;
  /** Estimated triangle count for budgeting. */
  estimatedTriangles: number;
  /** Estimated bytes for bandwidth budgeting. */
  estimatedBytes: number;
}

/** Texture variant for dimension T. */
export interface TextureVariant {
  /** 0 = untextured. */
  resolutionPx: number;
  url: string | null;
  estimatedBytes: number;
}

/** Component variant for dimension C: which sub-meshes are active. */
export interface ComponentVariant {
  activeComponents: string[];
}

/** Boundary-proxy variant for dimension B. */
export interface BoundaryVariant {
  kind: 'centroid' | 'bbox' | 'footprint' | 'footprint-context';
}

/** Semantic-depth variant for dimension S. */
export interface SemanticVariant {
  /** Metadata payload tier. */
  tier: 'id-only' | 'basic' | 'provenance' | 'full-evidence';
}

/** Full resource manifest for one state word. */
export interface ResourceManifest {
  word: number;
  geometry: GeometryVariant;
  texture: TextureVariant;
  components: ComponentVariant;
  boundary: BoundaryVariant;
  semantics: SemanticVariant;
  /** Sum of estimated bytes across fetchable resources. */
  estimatedBytes: number;
}

/** One load/unload entry: which dimension, which level, which descriptor. */
export interface ResourceFetchEntry {
  dimension: StateWordDimension;
  level: number;
  kind: 'geometry' | 'texture' | 'components' | 'boundary' | 'semantics';
  descriptor: GeometryVariant | TextureVariant | ComponentVariant | BoundaryVariant | SemanticVariant;
}

export interface FetchList {
  load: ResourceFetchEntry[];
  unload: ResourceFetchEntry[];
}

export interface ResourceManagerConfig {
  /** Base URL that relative asset URLs resolve against. */
  baseUrl: string;
  /** Per-object path segment, e.g. a tile/object id. Defaults to ''. */
  objectPath?: string;
}

const GEOMETRY_TABLE: Array<Omit<GeometryVariant, 'url'>> = [
  { lod: 'proxy', estimatedTriangles: 12, estimatedBytes: 2_048 },
  { lod: 'lod1', estimatedTriangles: 500, estimatedBytes: 48_000 },
  { lod: 'lod2', estimatedTriangles: 8_000, estimatedBytes: 640_000 },
  { lod: 'lod2-detail', estimatedTriangles: 32_000, estimatedBytes: 2_560_000 },
];

const TEXTURE_TABLE: Array<{ resolutionPx: number; estimatedBytes: number }> = [
  { resolutionPx: 0, estimatedBytes: 0 },
  { resolutionPx: 256, estimatedBytes: 196_608 },
  { resolutionPx: 1024, estimatedBytes: 3_145_728 },
  { resolutionPx: 2048, estimatedBytes: 12_582_912 },
];

const COMPONENT_TABLE: string[][] = [
  ['shell'],
  ['shell', 'roof'],
  ['shell', 'roof', 'openings'],
  ['shell', 'roof', 'openings', 'interior'],
];

const BOUNDARY_TABLE: BoundaryVariant['kind'][] = [
  'centroid',
  'bbox',
  'footprint',
  'footprint-context',
];

const SEMANTIC_TABLE: SemanticVariant['tier'][] = [
  'id-only',
  'basic',
  'provenance',
  'full-evidence',
];

export class StateResourceManager {
  private readonly baseUrl: string;
  private readonly objectPath: string;

  constructor(config: ResourceManagerConfig) {
    if (!config.baseUrl) throw new RangeError('baseUrl must be non-empty');
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.objectPath = (config.objectPath ?? '').replace(/^\/+|\/+$/g, '');
  }

  private assetUrl(kind: string, level: number, ext: string): string {
    const prefix = this.objectPath ? `${this.baseUrl}/${this.objectPath}` : this.baseUrl;
    return `${prefix}/${kind}-l${level}.${ext}`;
  }

  /** Map a state word to its full resource manifest (descriptors only). */
  getVariantForWord(word: number): ResourceManifest {
    assertValidStateWord(word);
    const b = decodeStateWord(word, 'B');
    const d = decodeStateWord(word, 'D');
    const c = decodeStateWord(word, 'C');
    const t = decodeStateWord(word, 'T');
    const s = decodeStateWord(word, 'S');

    const g = GEOMETRY_TABLE[d];
    const geometry: GeometryVariant = {
      lod: g.lod,
      url: d === 0 ? this.assetUrl('proxy', 0, 'glb') : this.assetUrl('mesh', d, 'glb'),
      estimatedTriangles: g.estimatedTriangles,
      estimatedBytes: g.estimatedBytes,
    };
    const tx = TEXTURE_TABLE[t];
    const texture: TextureVariant = {
      resolutionPx: tx.resolutionPx,
      url: t === 0 ? null : this.assetUrl('atlas', t, 'ktx2'),
      estimatedBytes: tx.estimatedBytes,
    };
    const components: ComponentVariant = { activeComponents: [...COMPONENT_TABLE[c]] };
    const boundary: BoundaryVariant = { kind: BOUNDARY_TABLE[b] };
    const semantics: SemanticVariant = { tier: SEMANTIC_TABLE[s] };

    return {
      word,
      geometry,
      texture,
      components,
      boundary,
      semantics,
      estimatedBytes: geometry.estimatedBytes + texture.estimatedBytes,
    };
  }

  /**
   * Diff two state words into load/unload lists. Builds on the scheduler's
   * chunksToFetch/chunksToRelease: dimensions whose level increased produce
   * load entries (target level's descriptor); decreased produce unload
   * entries (current level's descriptor).
   */
  getFetchList(currentWord: number, targetWord: number): FetchList {
    assertValidStateWord(currentWord);
    assertValidStateWord(targetWord);
    const target = this.getVariantForWord(targetWord);
    const current = this.getVariantForWord(currentWord);

    const load: ResourceFetchEntry[] = chunksToFetch(currentWord, targetWord).map((dim) => ({
      dimension: dim,
      level: decodeStateWord(targetWord, dim),
      ...this.entryFor(dim, target),
    }));
    const unload: ResourceFetchEntry[] = chunksToRelease(currentWord, targetWord).map((dim) => ({
      dimension: dim,
      level: decodeStateWord(currentWord, dim),
      ...this.entryFor(dim, current),
    }));
    return { load, unload };
  }

  private entryFor(
    dim: StateWordDimension,
    manifest: ResourceManifest,
  ): Pick<ResourceFetchEntry, 'kind' | 'descriptor'> {
    switch (dim) {
      case 'B':
        return { kind: 'boundary', descriptor: manifest.boundary };
      case 'D':
        return { kind: 'geometry', descriptor: manifest.geometry };
      case 'C':
        return { kind: 'components', descriptor: manifest.components };
      case 'T':
        return { kind: 'texture', descriptor: manifest.texture };
      case 'S':
        return { kind: 'semantics', descriptor: manifest.semantics };
    }
  }
}
