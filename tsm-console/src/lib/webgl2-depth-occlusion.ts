/**
 * Non-blocking WebGL2 depth-occlusion queries for the TSM Three.js custom layer.
 *
 * Probe bounds are tested against the depth buffer MapLibre has already written.
 * Results are polled asynchronously; QUERY_RESULT is only read after
 * QUERY_RESULT_AVAILABLE. Visibility is suppressed after two consecutive
 * zero-sample results and immediately restored after a passing result.
 *
 * This is a WebGL2 query implementation, not a hierarchical-Z/compute-shader
 * implementation. Unsupported and lost contexts fail open.
 */
import * as THREE from 'three';

interface TargetState {
  mesh: THREE.Mesh;
  query: WebGLQuery;
  pending: boolean;
  occludedFrames: number;
  occluded: boolean;
  baseVisible: boolean;
}

export interface WebGL2DepthOcclusionOptions {
  maxQueriesPerFrame?: number;
  /** Hard cap on allocated GPU query objects; overflow remains visible (fail open). */
  maxTrackedMeshes?: number;
  consecutiveOccludedFrames?: number;
}

const CUBE_TRIANGLES = new Float32Array([
  -1,-1,-1,  1,-1,-1,  1, 1,-1, -1,-1,-1, 1, 1,-1, -1, 1,-1,
  -1,-1, 1,  1, 1, 1,  1,-1, 1, -1,-1, 1, -1, 1, 1, 1, 1, 1,
  -1,-1,-1, -1, 1,-1, -1, 1, 1, -1,-1,-1, -1, 1, 1, -1,-1, 1,
   1,-1,-1,  1,-1, 1,  1, 1, 1, 1,-1,-1, 1, 1, 1, 1, 1,-1,
  -1,-1,-1, -1,-1, 1, 1,-1, 1, -1,-1,-1, 1,-1, 1, 1,-1,-1,
  -1, 1,-1, 1, 1, 1, -1, 1, 1, -1, 1,-1, 1, 1,-1, 1, 1, 1,
]);

const VERTEX_SHADER = [
  '#version 300 es',
  'in vec3 aPosition;',
  'uniform mat4 uViewProjection;',
  'uniform vec3 uCenter;',
  'uniform vec3 uHalfSize;',
  'void main() {',
  '  vec3 world = aPosition * uHalfSize + uCenter;',
  '  gl_Position = uViewProjection * vec4(world, 1.0);',
  '}',
].join('\n');

const FRAGMENT_SHADER = [
  '#version 300 es',
  'precision mediump float;',
  'out vec4 outColor;',
  'void main() { outColor = vec4(0.0); }',
].join('\n');

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('WebGL2 did not create an occlusion shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'no compiler log';
    gl.deleteShader(shader);
    throw new Error(`WebGL2 occlusion shader compilation failed: ${log}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  let fragment: WebGLShader;
  try {
    fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  } catch (error) {
    gl.deleteShader(vertex);
    throw error;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error('WebGL2 did not create an occlusion program');
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'no linker log';
    gl.deleteProgram(program);
    throw new Error(`WebGL2 occlusion shader linking failed: ${log}`);
  }
  return program;
}

function getUniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (location === null) throw new Error(`WebGL2 occlusion uniform was not found: ${name}`);
  return location;
}

export function nextOcclusionVisibility(
  previousOccludedFrames: number,
  samplesPassed: boolean,
  requiredConsecutiveOccludedFrames = 2,
): { occluded: boolean; occludedFrames: number } {
  if (!Number.isInteger(previousOccludedFrames) || previousOccludedFrames < 0) {
    throw new RangeError('previousOccludedFrames must be a non-negative integer');
  }
  if (!Number.isInteger(requiredConsecutiveOccludedFrames) || requiredConsecutiveOccludedFrames < 1) {
    throw new RangeError('requiredConsecutiveOccludedFrames must be a positive integer');
  }
  if (samplesPassed) return { occluded: false, occludedFrames: 0 };
  const occludedFrames = previousOccludedFrames + 1;
  return { occluded: occludedFrames >= requiredConsecutiveOccludedFrames, occludedFrames };
}

export class WebGL2DepthOcclusionController {
  private readonly gl: WebGL2RenderingContext;
  private readonly maxQueriesPerFrame: number;
  private readonly maxTrackedMeshes: number;
  private readonly consecutiveOccludedFrames: number;
  private warnedTargetLimit = false;
  private readonly targets = new Map<THREE.Mesh, TargetState>();
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly vertexBuffer: WebGLBuffer;
  private readonly viewProjectionUniform: WebGLUniformLocation;
  private readonly centerUniform: WebGLUniformLocation;
  private readonly halfSizeUniform: WebGLUniformLocation;
  private cursor = 0;
  private disposed = false;

  constructor(gl: WebGL2RenderingContext, options: WebGL2DepthOcclusionOptions = {}) {
    if (typeof gl.createQuery !== 'function' ||
        typeof gl.getQueryParameter !== 'function' ||
        typeof gl.ANY_SAMPLES_PASSED_CONSERVATIVE !== 'number') {
      throw new Error('WebGL2 asynchronous occlusion queries are not supported by this context');
    }
    this.gl = gl;
    this.maxQueriesPerFrame = options.maxQueriesPerFrame ?? 64;
    this.maxTrackedMeshes = options.maxTrackedMeshes ?? 2048;
    this.consecutiveOccludedFrames = options.consecutiveOccludedFrames ?? 2;
    if (!Number.isInteger(this.maxQueriesPerFrame) || this.maxQueriesPerFrame < 1) {
      throw new RangeError('maxQueriesPerFrame must be a positive integer');
    }
    if (!Number.isInteger(this.maxTrackedMeshes) || this.maxTrackedMeshes < 1 || this.maxTrackedMeshes > 16384) {
      throw new RangeError('maxTrackedMeshes must be an integer in [1, 16384]');
    }
    if (!Number.isInteger(this.consecutiveOccludedFrames) || this.consecutiveOccludedFrames < 1) {
      throw new RangeError('consecutiveOccludedFrames must be a positive integer');
    }

    const program = createProgram(gl);
    const vao = gl.createVertexArray();
    const vertexBuffer = gl.createBuffer();
    if (!vao || !vertexBuffer) {
      gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
      if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
      throw new Error('WebGL2 failed to allocate occlusion probe resources');
    }
    this.program = program;
    this.vao = vao;
    this.vertexBuffer = vertexBuffer;
    this.viewProjectionUniform = getUniform(gl, program, 'uViewProjection');
    this.centerUniform = getUniform(gl, program, 'uCenter');
    this.halfSizeUniform = getUniform(gl, program, 'uHalfSize');

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, CUBE_TRIANGLES, gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    if (position < 0) {
      gl.deleteBuffer(vertexBuffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      throw new Error('WebGL2 occlusion probe position attribute was not found');
    }
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  registerRoot(root: THREE.Object3D): void {
    if (this.disposed) return;
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || this.targets.has(object)) return;
      if (this.targets.size >= this.maxTrackedMeshes) {
        // Query objects consume driver resources. Meshes beyond the configured
        // cap are simply left visible rather than allocating without a bound.
        if (!this.warnedTargetLimit) {
          this.warnedTargetLimit = true;
          console.warn(
            `[Tiles3D] Occlusion target cap (${this.maxTrackedMeshes}) reached; remaining meshes stay visible`,
          );
        }
        return;
      }
      const query = this.gl.createQuery();
      if (!query) return;
      this.targets.set(object, {
        mesh: object,
        query,
        pending: false,
        occludedFrames: 0,
        occluded: false,
        baseVisible: object.visible,
      });
    });
  }

  unregisterRoot(root: THREE.Object3D, shouldBeVisible?: (mesh: THREE.Mesh) => boolean): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const state = this.targets.get(object);
      if (!state) return;
      object.visible = shouldBeVisible?.(object) ?? state.baseVisible;
      this.gl.deleteQuery(state.query);
      this.targets.delete(object);
    });
  }

  isOccluded(mesh: THREE.Mesh): boolean {
    return this.targets.get(mesh)?.occluded ?? false;
  }

  baseVisible(mesh: THREE.Mesh): boolean {
    return this.targets.get(mesh)?.baseVisible ?? mesh.visible;
  }

  update(
    camera: THREE.Camera,
    shouldBeVisible: (mesh: THREE.Mesh) => boolean = (mesh) => this.targets.get(mesh)?.baseVisible ?? true,
  ): void {
    if (this.disposed || this.targets.size === 0) return;
    const gl = this.gl;
    try {
      this.pollResults(shouldBeVisible);
      const entries = Array.from(this.targets.values()).filter((state) => !state.pending);
      if (entries.length === 0) return;
      const count = Math.min(this.maxQueriesPerFrame, entries.length);
      const start = this.cursor % entries.length;
      const selected = Array.from({ length: count }, (_, index) => entries[(start + index) % entries.length]);
      this.cursor = (start + count) % Math.max(1, entries.length);

      camera.updateMatrixWorld(true);
      const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const savedProgram = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
      const savedVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null;
      const savedArrayBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING) as WebGLBuffer | null;
      const savedColorMask = gl.getParameter(gl.COLOR_WRITEMASK) as boolean[];
      const savedDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK) as boolean;
      const savedDepthFunc = gl.getParameter(gl.DEPTH_FUNC) as number;
      const blendEnabled = gl.isEnabled(gl.BLEND);
      const cullEnabled = gl.isEnabled(gl.CULL_FACE);
      const depthEnabled = gl.isEnabled(gl.DEPTH_TEST);
      const stencilEnabled = gl.isEnabled(gl.STENCIL_TEST);
      const polygonOffsetEnabled = gl.isEnabled(gl.POLYGON_OFFSET_FILL);

      try {
        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(false);
        gl.colorMask(false, false, false, false);
        gl.disable(gl.BLEND);
        gl.disable(gl.CULL_FACE);
        // Host-layer stencil and polygon-offset state must not invalidate
        // visibility queries against the shared depth buffer.
        gl.disable(gl.STENCIL_TEST);
        gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.uniformMatrix4fv(this.viewProjectionUniform, false, viewProjection.elements);
        for (const state of selected) {
          if (state.pending) continue;
          const geometry = state.mesh.geometry;
          if (!geometry.boundingBox) geometry.computeBoundingBox();
          const localBounds = geometry.boundingBox;
          if (!localBounds || localBounds.isEmpty()) continue;
          state.mesh.updateWorldMatrix(true, false);
          const worldBounds = localBounds.clone().applyMatrix4(state.mesh.matrixWorld);
          if (worldBounds.isEmpty()) continue;
          const center = worldBounds.getCenter(new THREE.Vector3());
          const halfSize = worldBounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
          if (![center.x, center.y, center.z, halfSize.x, halfSize.y, halfSize.z].every(Number.isFinite)) continue;
          halfSize.set(Math.max(halfSize.x, 0.001), Math.max(halfSize.y, 0.001), Math.max(halfSize.z, 0.001));
          gl.uniform3f(this.centerUniform, center.x, center.y, center.z);
          gl.uniform3f(this.halfSizeUniform, halfSize.x, halfSize.y, halfSize.z);
          gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, state.query);
          gl.drawArrays(gl.TRIANGLES, 0, 36);
          gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);
          state.pending = true;
        }
      } finally {
        gl.colorMask(savedColorMask[0], savedColorMask[1], savedColorMask[2], savedColorMask[3]);
        gl.depthMask(savedDepthMask);
        gl.depthFunc(savedDepthFunc);
        if (blendEnabled) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
        if (cullEnabled) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
        if (depthEnabled) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
        if (stencilEnabled) gl.enable(gl.STENCIL_TEST); else gl.disable(gl.STENCIL_TEST);
        if (polygonOffsetEnabled) gl.enable(gl.POLYGON_OFFSET_FILL); else gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.bindVertexArray(savedVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, savedArrayBuffer);
        gl.useProgram(savedProgram);
      }
      for (const state of this.targets.values()) {
        state.mesh.visible = state.occluded ? false : shouldBeVisible(state.mesh);
      }
    } catch (error) {
      console.warn('[Tiles3D] Disabling WebGL2 depth occlusion after a query error:', error);
      this.failOpen(shouldBeVisible);
    }
  }

  private pollResults(shouldBeVisible: (mesh: THREE.Mesh) => boolean): void {
    const gl = this.gl;
    for (const state of this.targets.values()) {
      if (!state.pending) continue;
      if (gl.getQueryParameter(state.query, gl.QUERY_RESULT_AVAILABLE) !== true) continue;
      const samplesPassed = gl.getQueryParameter(state.query, gl.QUERY_RESULT) === true;
      state.pending = false;
      const next = nextOcclusionVisibility(
        state.occludedFrames,
        samplesPassed,
        this.consecutiveOccludedFrames,
      );
      state.occludedFrames = next.occludedFrames;
      state.occluded = next.occluded;
      state.mesh.visible = state.occluded ? false : shouldBeVisible(state.mesh);
    }
  }

  private failOpen(shouldBeVisible: (mesh: THREE.Mesh) => boolean): void {
    const gl = this.gl;
    for (const state of this.targets.values()) {
      state.occluded = false;
      state.occludedFrames = 0;
      state.pending = false;
      state.mesh.visible = shouldBeVisible(state.mesh);
      try { gl.deleteQuery(state.query); } catch { /* context may already be lost */ }
      const replacement = gl.createQuery();
      if (replacement) state.query = replacement;
      else this.targets.delete(state.mesh);
    }
  }

  dispose(shouldBeVisible?: (mesh: THREE.Mesh) => boolean): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const state of this.targets.values()) {
      state.mesh.visible = shouldBeVisible?.(state.mesh) ?? state.baseVisible;
      try { this.gl.deleteQuery(state.query); } catch { /* context may already be lost */ }
    }
    this.targets.clear();
    this.gl.deleteBuffer(this.vertexBuffer);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }
}
