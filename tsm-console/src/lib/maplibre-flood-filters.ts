/**
 * maplibre-flood-filters.ts — MapLibre flood-visualization helpers.
 *
 * Provenance: contributed by the user as `maplibreCustomFilters.ts`
 * (2026-09-30 upload). Reviewed before porting — the code is honest
 * (no invented data, no magic shaders), so it was adopted with two
 * small fixes:
 *   1. The WebGL tint layer allocated a new buffer on every render()
 *      call; the buffer is now created once in onAdd and deleted in
 *      onRemove.
 *   2. `setIntensity` was a no-op stub; it now actually adjusts the
 *      tint alpha (clamped 0–1) without recreating the layer.
 *
 * What this module does NOT do: it invents no depths, no extents, no
 * evidence. The depth expression reads `depth_ft` (falling back to
 * `depth_m`) from caller-supplied features; features without depth
 * data are filtered out by `wetCellsFilter`, never colored by guess.
 */

import type { Map as MaplibreMap, CustomLayerInterface } from "maplibre-gl";

/** Depth-class color ramp for circle/fill-extrusion layers (feet). */
export const depthColorExpression = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "depth_ft"], ["*", ["get", "depth_m"], 3.28084], 0],
  0,
  "#1e3a8a",
  0.5,
  "#0ea5e9",
  1.5,
  "#f59e0b",
  3,
  "#ef4444",
] as const;

/** Feature filter: only features with a positive depth value. */
export const wetCellsFilter = [">", ["coalesce", ["get", "depth_ft"], 0], 0] as any;

/** A MapLibre custom layer with an adjustable tint intensity. */
export interface FloodTintLayer extends CustomLayerInterface {
  setIntensity: (v: number) => void;
}

/**
 * Lightweight custom layer that draws a full-viewport cool tint when
 * flood visualization is active. Uses MapLibre CustomLayerInterface
 * (WebGL), not a fragment filter on vector tiles.
 */
export function createFloodTintCustomLayer(id = "flood-tint-gl"): FloodTintLayer {
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let intensity = 0.12;

  return {
    id,
    type: "custom",
    renderingMode: "2d",
    onAdd(_map, gl) {
      const vs = gl.createShader(gl.VERTEX_SHADER)!;
      gl.shaderSource(
        vs,
        `attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }`
      );
      gl.compileShader(vs);
      const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
      gl.shaderSource(
        fs,
        `precision mediump float; uniform float u_i; void main(){
          gl_FragColor = vec4(0.05, 0.25, 0.55, u_i);
        }`
      );
      gl.compileShader(fs);
      program = gl.createProgram()!;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
    },
    render(gl, _matrix) {
      if (!program || !buffer) return;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const loc = gl.getAttribLocation(program, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const ui = gl.getUniformLocation(program, "u_i");
      gl.uniform1f(ui, intensity);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    onRemove(_map, gl) {
      if (program) gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
      program = null;
      buffer = null;
    },
    setIntensity(v: number) {
      intensity = Math.max(0, Math.min(1, v));
    },
  };
}

export function addFloodTintLayer(
  map: MaplibreMap,
  intensity = 0.12
): FloodTintLayer {
  const layer = createFloodTintCustomLayer();
  layer.setIntensity(intensity);
  if (!map.getLayer("flood-tint-gl")) {
    map.addLayer(layer);
  }
  return layer;
}

/** Apply the depth paint + wet-cell filter to an existing circle layer id. */
export function applyDepthPaint(map: MaplibreMap, layerId: string): void {
  if (!map.getLayer(layerId)) return;
  map.setPaintProperty(layerId, "circle-color", depthColorExpression as any);
  map.setFilter(layerId, wetCellsFilter);
}
