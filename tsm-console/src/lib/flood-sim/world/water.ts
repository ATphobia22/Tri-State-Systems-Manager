/**
 * world/water.ts — dynamic water surface driven by the engine depth grid.
 *
 * RENDERING HONESTY: this is a real-time rasterized approximation — a
 * displaced plane with a stylized fresnel + specular sun-glint shader and
 * exponential fog. It is NOT path tracing, NOT a physically-based spectral
 * water model, and the UI labels it "real-time approximation".
 *
 * Each frame (or sim tick) `updateFromDepth()` writes water-surface heights
 * (ground elevation + depth) into the plane vertices and pushes per-vertex
 * depth into the `aDepth` attribute; the shader fades cells with < ~0.03 ft
 * of water to transparent so dry land shows through.
 */

import * as THREE from 'three';

export interface WaterSurfaceOptions {
  /** Domain size in feet (matches terrain). */
  widthFt: number;
  depthFt: number;
  /** Plane segments per side (quality tier). */
  segments: number;
  /** Sun direction (world, normalized internally). */
  sunDirection?: THREE.Vector3;
  /** Extra normal perturbation for glint sparkle (quality tier). */
  detailLevel?: number;
}

const WATER_VERTEX_SHADER = /* glsl */ `
  attribute float aDepth;
  varying float vDepth;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  void main() {
    vDepth = aDepth;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WATER_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying float vDepth;
  varying vec3 vWorldPos;
  varying vec3 vNormalW;
  uniform vec3 uSunDir;
  uniform vec3 uCamPos;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uSunColor;
  uniform float uTime;
  uniform float uDetail;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  // Cheap analytic ripple normal perturbation (visual only).
  vec3 perturbedNormal(vec3 n, vec3 p, float t) {
    float e = 0.6;
    float h0 = sin(p.x * 0.11 + t * 1.7) * cos(p.z * 0.13 - t * 1.3);
    float hx = sin((p.x + e) * 0.11 + t * 1.7) * cos(p.z * 0.13 - t * 1.3);
    float hz = sin(p.x * 0.11 + t * 1.7) * cos((p.z + e) * 0.13 - t * 1.3);
    vec3 pn = normalize(vec3(n.x - (hx - h0) * uDetail, 1.0, n.z - (hz - h0) * uDetail));
    return pn;
  }

  void main() {
    if (vDepth < 0.03) discard;
    vec3 n = perturbedNormal(normalize(vNormalW), vWorldPos, uTime);
    vec3 viewDir = normalize(uCamPos - vWorldPos);

    // Fresnel: grazing angles reflect sky-ish shallow tint.
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    float depthT = clamp(vDepth / 6.0, 0.0, 1.0);
    vec3 base = mix(uShallowColor, uDeepColor, depthT);
    vec3 col = mix(base, vec3(0.62, 0.72, 0.78), fres * 0.55);

    // Specular sun glint (Blinn-Phong, tight lobe).
    vec3 halfV = normalize(normalize(uSunDir) + viewDir);
    float spec = pow(max(dot(n, halfV), 0.0), 220.0);
    col += uSunColor * spec * 1.6;
    // Broad sheen so the surface reads as water even off-glint.
    float sheen = pow(max(dot(n, halfV), 0.0), 24.0);
    col += uSunColor * sheen * 0.12;

    float alpha = mix(0.72, 0.94, depthT);

    // Exponential fog (matches scene FogExp2).
    float dist = length(uCamPos - vWorldPos);
    float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));

    gl_FragColor = vec4(col, alpha);
  }
`;

export class WaterSurface {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly depthAttr: THREE.BufferAttribute;
  private readonly nx: number;
  private readonly ny: number;
  private readonly dxFt: number;
  private timeSec = 0;

  constructor(
    opts: WaterSurfaceOptions & { nx: number; ny: number; dxFt: number },
  ) {
    this.nx = opts.nx;
    this.ny = opts.ny;
    this.dxFt = opts.dxFt;
    const sun = (opts.sunDirection ?? new THREE.Vector3(-0.45, 0.62, 0.35)).normalize();

    this.geometry = new THREE.PlaneGeometry(opts.widthFt, opts.depthFt, opts.segments, opts.segments);
    this.geometry.rotateX(-Math.PI / 2);

    const count = this.geometry.attributes.position.count;
    this.depthAttr = new THREE.BufferAttribute(new Float32Array(count), 1);
    this.geometry.setAttribute('aDepth', this.depthAttr);

    this.material = new THREE.ShaderMaterial({
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSunDir: { value: sun.clone() },
        uCamPos: { value: new THREE.Vector3() },
        uDeepColor: { value: new THREE.Color(0.05, 0.19, 0.28) },
        uShallowColor: { value: new THREE.Color(0.32, 0.5, 0.52) },
        uSunColor: { value: new THREE.Color(1.0, 0.93, 0.78) },
        uTime: { value: 0 },
        uDetail: { value: opts.detailLevel ?? 1 },
        uFogColor: { value: new THREE.Color(0.74, 0.8, 0.86) },
        uFogDensity: { value: 0.00012 },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'flood-sim-water (real-time approximation — not path traced)';
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;
  }

  /**
   * Drive vertex heights from the engine state. `depthFt`/`elevationFt` are
   * ny × nx grids; the plane's (segments+1)² vertices are resampled with
   * bilinear interpolation so quality tiers don't change the physics grid.
   */
  updateFromDepth(depthFt: number[][], elevationFt: number[][]): void {
    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    const widthFt = this.nx * this.dxFt;
    const depthSpanFt = this.ny * this.dxFt;
    const sample = (grid: number[][], col: number, row: number): number => {
      const c = Math.min(this.nx - 1.001, Math.max(0, col));
      const r = Math.min(this.ny - 1.001, Math.max(0, row));
      const c0 = Math.floor(c);
      const r0 = Math.floor(r);
      const fc = c - c0;
      const fr = r - r0;
      const a = grid[r0][c0];
      const b = grid[r0][c0 + 1];
      const cc = grid[r0 + 1][c0];
      const d = grid[r0 + 1][c0 + 1];
      return a + (b - a) * fc + (cc - a) * fr + (a - b - cc + d) * fc * fr;
    };
    for (let vi = 0; vi < pos.count; vi += 1) {
      const x = pos.getX(vi);
      const z = pos.getZ(vi);
      const col = (x + widthFt / 2) / this.dxFt - 0.5;
      const row = (z + depthSpanFt / 2) / this.dxFt - 0.5;
      const d = sample(depthFt, col, row);
      const e = sample(elevationFt, col, row);
      pos.setY(vi, e + Math.max(0, d) + 0.02);
      this.depthAttr.setX(vi, d);
    }
    pos.needsUpdate = true;
    this.depthAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  /** Per-frame visual update: camera position + shader clock. */
  updateVisual(camera: THREE.Camera, dtSec: number): void {
    this.timeSec += dtSec;
    this.material.uniforms.uTime.value = this.timeSec;
    (this.material.uniforms.uCamPos.value as THREE.Vector3).copy(camera.position);
  }

  setDetail(level: number): void {
    this.material.uniforms.uDetail.value = level;
  }

  setSunDirection(dir: THREE.Vector3): void {
    (this.material.uniforms.uSunDir.value as THREE.Vector3).copy(dir).normalize();
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
