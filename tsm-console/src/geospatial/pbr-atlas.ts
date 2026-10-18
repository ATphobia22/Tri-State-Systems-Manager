/**
 * PBR atlas contracts for TSM glTF 2.0 materials (T-dimension).
 * Packed channels follow glTF metallic-roughness:
 *   - baseColor (RGBA)
 *   - normal (RGB)
 *   - metallicRoughness: G=roughness, B=metallic (glTF ORM)
 *   - occlusion: R channel (may share ORM texture)
 */

export type PbrChannel =
  | 'albedo'
  | 'normal'
  | 'roughness'
  | 'metallic'
  | 'occlusion'
  | 'emissive';

export interface PbrAtlasManifest {
  schema: 'tsm-pbr-atlas-v1';
  name: string;
  width: number;
  height: number;
  textures: {
    baseColor?: string;
    normal?: string;
    metallicRoughness?: string;
    occlusion?: string;
    emissive?: string;
  };
  packing: {
    metallicRoughness: 'glTF_ORM';
    normalSpace: 'tangent';
    colorSpace: 'sRGB_baseColor_linear_others';
  };
  authorityClass: 'DERIVED';
  engineeringUse: false;
  regulatoryUse: false;
}

export interface GltfPbrMaterialTemplate {
  name: string;
  pbrMetallicRoughness: {
    baseColorTexture?: { index: number; texCoord?: number };
    metallicRoughnessTexture?: { index: number; texCoord?: number };
    baseColorFactor: [number, number, number, number];
    metallicFactor: number;
    roughnessFactor: number;
  };
  normalTexture?: { index: number; texCoord?: number; scale?: number };
  occlusionTexture?: { index: number; texCoord?: number; strength?: number };
  emissiveTexture?: { index: number; texCoord?: number };
  emissiveFactor: [number, number, number];
  doubleSided: boolean;
}

export class PbrAtlasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PbrAtlasError';
  }
}

export function createDefaultAtlasManifest(
  name: string,
  width: number,
  height: number,
): PbrAtlasManifest {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new PbrAtlasError(`Invalid atlas dimensions ${width}x${height}`);
  }
  if ((width & (width - 1)) !== 0 || (height & (height - 1)) !== 0) {
    throw new PbrAtlasError('Atlas dimensions must be powers of two for GPU streaming');
  }
  return {
    schema: 'tsm-pbr-atlas-v1',
    name,
    width,
    height,
    textures: {
      baseColor: 'baseColor.png',
      normal: 'normal.png',
      metallicRoughness: 'metallicRoughness.png',
      occlusion: 'occlusion.png',
    },
    packing: {
      metallicRoughness: 'glTF_ORM',
      normalSpace: 'tangent',
      colorSpace: 'sRGB_baseColor_linear_others',
    },
    authorityClass: 'DERIVED',
    engineeringUse: false,
    regulatoryUse: false,
  };
}

export function buildGltfMaterialTemplate(name: string): GltfPbrMaterialTemplate {
  return {
    name,
    pbrMetallicRoughness: {
      baseColorTexture: { index: 0, texCoord: 0 },
      metallicRoughnessTexture: { index: 1, texCoord: 0 },
      baseColorFactor: [1, 1, 1, 1],
      metallicFactor: 1,
      roughnessFactor: 1,
    },
    normalTexture: { index: 2, texCoord: 0, scale: 1 },
    occlusionTexture: { index: 3, texCoord: 0, strength: 1 },
    emissiveFactor: [0, 0, 0],
    doubleSided: false,
  };
}

export function packOrmChannels(
  width: number,
  height: number,
  roughness: Uint8Array,
  metallic: Uint8Array,
  occlusion?: Uint8Array,
): Uint8Array {
  const n = width * height;
  if (roughness.length !== n || metallic.length !== n) {
    throw new PbrAtlasError('roughness/metallic length must equal width*height');
  }
  if (occlusion && occlusion.length !== n) {
    throw new PbrAtlasError('occlusion length must equal width*height');
  }
  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    rgba[o] = occlusion ? occlusion[i] : 255;
    rgba[o + 1] = roughness[i];
    rgba[o + 2] = metallic[i];
    rgba[o + 3] = 255;
  }
  return rgba;
}

export function validateAtlasManifest(manifest: PbrAtlasManifest): void {
  if (manifest.schema !== 'tsm-pbr-atlas-v1') {
    throw new PbrAtlasError(`Unsupported schema ${manifest.schema}`);
  }
  if (manifest.engineeringUse || manifest.regulatoryUse) {
    throw new PbrAtlasError('Derived PBR atlases cannot claim engineering/regulatory use');
  }
  if (manifest.packing.metallicRoughness !== 'glTF_ORM') {
    throw new PbrAtlasError('Only glTF_ORM packing is supported');
  }
  createDefaultAtlasManifest(manifest.name, manifest.width, manifest.height);
}
