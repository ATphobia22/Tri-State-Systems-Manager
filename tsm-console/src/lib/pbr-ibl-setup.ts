/**
 * pbr-ibl-setup.ts — PBR image-based lighting for the Three.js custom layer.
 *
 * Research basis: mapping-planes-lod-integration-20261018-0426
 * - three.js PMREMGenerator + RoomEnvironment: procedural HDR environment,
 *   no external HDRI download needed (air-gapped friendly).
 * - scene.environment gives IBL to every PBR material incl. GLTF-loaded ones.
 * - MapLibre GL JS native style has NO IBL (style-spec `light` object only);
 *   PBR/IBL requires the Three.js custom-layer path — which is this module.
 *
 * glTF 2.0 PBR channels honored: baseColor(albedo, sRGB),
 * metallicRoughness (G=roughness, B=metallic), normal, occlusion, emissive.
 * KHR_materials_unlit recommended for photogrammetry-derived meshes.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface IblConfig {
  /** Environment intensity multiplier. Default 1.0. */
  intensity?: number;
  /** PMREM blur sigma. Default 0.04. */
  blurSigma?: number;
  /** ACESFilmicToneMapping exposure. Default 1.1. */
  exposure?: number;
}

/**
 * Attach procedural IBL to a Three.js scene. Returns a dispose function.
 * Safe to call once per scene; re-calling replaces the previous environment.
 */
export function setupPbrIbl(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  config: IblConfig = {},
): () => void {
  const { intensity = 1.0, blurSigma = 0.04, exposure = 1.1 } = config;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  // sRGB output is default in modern three; keep explicit for clarity.
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), blurSigma).texture;
  const previous = scene.environment;
  scene.environment = envTexture;
  scene.environmentIntensity = intensity;

  return () => {
    scene.environment = previous ?? null;
    envTexture.dispose();
    pmrem.dispose();
  };
}

/**
 * Mark a GLTF-loaded mesh's materials as unlit (KHR_materials_unlit equivalent).
 * Use for photogrammetry-derived meshes where baked lighting already exists.
 */
export function applyUnlitToPhotogrammetry(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const mat = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
    if (!mat || !(mesh as { isMesh?: boolean }).isMesh) return;
    const mats = Array.isArray(mat) ? mat : [mat];
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial;
      if ('roughness' in std) {
        std.roughness = 1.0;
        std.metalness = 0.0;
      }
    }
  });
}
