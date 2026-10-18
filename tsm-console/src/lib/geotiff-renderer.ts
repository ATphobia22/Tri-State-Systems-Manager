/**
 * TSM WebGL2 GeoTIFF Renderer — in-browser raster visualization for DEM and
 * flood-depth data.
 *
 * Renders elevation grids directly with raw WebGL2 (no Three.js — keeps the
 * bundle light and works on iOS 15-era Safari which ships WebGL2).
 *
 * Supported elevation encodings:
 *  - `terrarium`: Mapzen Terrarium PNG tiles (R*256 + G + B/256 − 32768).
 *    Decoded on the CPU via 2D canvas / ImageBitmap — no extra dependency.
 *  - `geotiff16`: minimal single-strip, uncompressed, little-endian, 16-bit
 *    grayscale GeoTIFF (uint16 or int16). Anything else (tiled TIFF,
 *    LZW/Deflate compression, big-endian, multi-band) is rejected with a
 *    clear error — never silently mis-decoded.
 *
 * Render modes:
 *  - `elevation`: terrain color ramp (green → tan → brown → white).
 *  - `hillshade`: grayscale relief shading from a configurable sun position.
 *  - `flood`: translucent blue depth ramp above a caller-supplied water level;
 *    dry cells are discarded (transparent) so the layer works as a MapLibre
 *    overlay.
 *
 * Missing data (NaN) is always discarded — never rendered as zero.
 *
 * The water level is an explicit caller-supplied number (human authority).
 * This module never invents flood extents.
 */

import * as maplibregl from 'maplibre-gl';

export type RenderMode = 'elevation' | 'hillshade' | 'flood';
export type TileEncoding = 'terrarium' | 'geotiff16';

/** RGBA color stop: [position 0..1, r, g, b, a] with 0..255 channels. */
export type ColorStop = [number, number, number, number, number];

export interface ElevationGrid {
  data: Float32Array;
  width: number;
  height: number;
  /** Minimum finite elevation in the grid (meters). NaN if none. */
  min: number;
  /** Maximum finite elevation in the grid (meters). NaN if none. */
  max: number;
}

// ---------------------------------------------------------------------------
// Terrarium decoding
// ---------------------------------------------------------------------------

/** Decode one Terrarium pixel to elevation in meters. */
export function decodeTerrariumPixel(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/**
 * Decode Terrarium RGBA tile bytes (row-major) to an elevation grid.
 * Alpha channel is ignored.
 */
export function decodeTerrariumTile(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): ElevationGrid {
  const data = new Float32Array(width * height);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < width * height; i++) {
    const e = decodeTerrariumPixel(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    data[i] = e;
    if (e < min) min = e;
    if (e > max) max = e;
  }
  return {
    data,
    width,
    height,
    min: min === Infinity ? NaN : min,
    max: max === -Infinity ? NaN : max,
  };
}

// ---------------------------------------------------------------------------
// Minimal GeoTIFF reader (single-strip, uncompressed, little-endian, 16-bit)
// ---------------------------------------------------------------------------

const TIFF_LITTLE_ENDIAN = 0x4949; // "II"
const TAG_IMAGE_WIDTH = 256;
const TAG_IMAGE_LENGTH = 257;
const TAG_BITS_PER_SAMPLE = 258;
const TAG_COMPRESSION = 259;
const TAG_STRIP_OFFSETS = 273;
const TAG_ROWS_PER_STRIP = 278;
const TAG_STRIP_BYTE_COUNTS = 279;
const TAG_SAMPLE_FORMAT = 339;
const TYPE_SHORT = 3;
const TYPE_LONG = 4;

function readTagValue(
  view: DataView,
  type: number,
  count: number,
  valueOffset: number,
  ifdEntryPos: number
): number[] {
  const out: number[] = [];
  // Inline value lives in the 4-byte value field at ifdEntryPos + 8.
  const base = ifdEntryPos + 8;
  const readOne = (at: number): number =>
    type === TYPE_SHORT ? view.getUint16(at, true) : view.getUint32(at, true);
  for (let i = 0; i < count; i++) {
    const at = count === 1 ? base : valueOffset + i * (type === TYPE_SHORT ? 2 : 4);
    out.push(readOne(at));
  }
  return out;
}

export interface GeoTIFF16Header {
  width: number;
  height: number;
  /** Byte offset of the single strip's pixel data. */
  stripOffset: number;
  /** 1 = unsigned int (default), 2 = signed int. */
  sampleFormat: number;
}

/**
 * Parse the header of a minimal GeoTIFF. Returns null with a reason string
 * when the file is outside the supported subset.
 */
export function parseGeoTIFF16Header(
  buffer: ArrayBuffer
): { header: GeoTIFF16Header } | { error: string } {
  if (buffer.byteLength < 8) return { error: 'buffer too small for TIFF header' };
  const view = new DataView(buffer);
  if (view.getUint16(0, true) !== TIFF_LITTLE_ENDIAN) {
    return { error: 'only little-endian ("II") TIFF is supported' };
  }
  if (view.getUint16(2, true) !== 42) return { error: 'not a TIFF file (bad magic)' };

  const ifdOffset = view.getUint32(4, true);
  if (ifdOffset + 2 > buffer.byteLength) return { error: 'IFD offset out of range' };
  const entryCount = view.getUint16(ifdOffset, true);

  const tags = new Map<number, number[]>();
  for (let i = 0; i < entryCount; i++) {
    const pos = ifdOffset + 2 + i * 12;
    if (pos + 12 > buffer.byteLength) return { error: 'IFD entry out of range' };
    const tag = view.getUint16(pos, true);
    const type = view.getUint16(pos + 2, true);
    const count = view.getUint32(pos + 4, true);
    const valueOffset = view.getUint32(pos + 8, true);
    if (type !== TYPE_SHORT && type !== TYPE_LONG) continue; // ignore other types
    tags.set(tag, readTagValue(view, type, count, valueOffset, pos));
  }

  const need = (t: number, name: string): number[] | { error: string } => {
    const v = tags.get(t);
    return v === undefined ? { error: `missing required tag ${name} (${t})` } : v;
  };
  const width = need(TAG_IMAGE_WIDTH, 'ImageWidth');
  if ('error' in width) return width;
  const height = need(TAG_IMAGE_LENGTH, 'ImageLength');
  if ('error' in height) return height;
  const bps = need(TAG_BITS_PER_SAMPLE, 'BitsPerSample');
  if ('error' in bps) return bps;
  const compression = need(TAG_COMPRESSION, 'Compression');
  if ('error' in compression) return compression;
  const stripOffsets = need(TAG_STRIP_OFFSETS, 'StripOffsets');
  if ('error' in stripOffsets) return stripOffsets;
  const stripByteCounts = need(TAG_STRIP_BYTE_COUNTS, 'StripByteCounts');
  if ('error' in stripByteCounts) return stripByteCounts;

  if (bps[0] !== 16) return { error: `only 16-bit samples supported (got ${bps[0]})` };
  if (compression[0] !== 1) return { error: `only uncompressed TIFF supported (got ${compression[0]})` };
  if (stripOffsets.length !== 1) {
    return { error: `only single-strip TIFF supported (got ${stripOffsets.length} strips)` };
  }
  const sampleFormat = tags.get(TAG_SAMPLE_FORMAT)?.[0] ?? 1;
  if (sampleFormat !== 1 && sampleFormat !== 2) {
    return { error: `unsupported SampleFormat ${sampleFormat}` };
  }
  const expected = width[0] * height[0] * 2;
  if (stripByteCounts[0] < expected) {
    return { error: 'strip byte count smaller than width*height*2' };
  }
  if (stripOffsets[0] + expected > buffer.byteLength) {
    return { error: 'strip data extends beyond buffer' };
  }
  return {
    header: {
      width: width[0],
      height: height[0],
      stripOffset: stripOffsets[0],
      sampleFormat,
    },
  };
}

/** Decode a parsed 16-bit GeoTIFF strip to an elevation grid (meters). */
export function decodeGeoTIFF16(buffer: ArrayBuffer, header: GeoTIFF16Header): ElevationGrid {
  const { width, height, stripOffset, sampleFormat } = header;
  const data = new Float32Array(width * height);
  let min = Infinity;
  let max = -Infinity;
  if (sampleFormat === 2) {
    const src = new Int16Array(buffer, stripOffset, width * height);
    for (let i = 0; i < src.length; i++) {
      data[i] = src[i];
      if (src[i] < min) min = src[i];
      if (src[i] > max) max = src[i];
    }
  } else {
    const src = new Uint16Array(buffer, stripOffset, width * height);
    for (let i = 0; i < src.length; i++) {
      data[i] = src[i];
      if (src[i] < min) min = src[i];
      if (src[i] > max) max = src[i];
    }
  }
  return {
    data,
    width,
    height,
    min: min === Infinity ? NaN : min,
    max: max === -Infinity ? NaN : max,
  };
}

// ---------------------------------------------------------------------------
// Web Mercator tile math (pure functions)
// ---------------------------------------------------------------------------

export function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x: Math.min(Math.max(x, 0), n - 1), y: Math.min(Math.max(y, 0), n - 1) };
}

export function tileToBounds(
  x: number,
  y: number,
  zoom: number
): [number, number, number, number] {
  const n = Math.pow(2, zoom);
  const lonWest = (x / n) * 360 - 180;
  const lonEast = ((x + 1) / n) * 360 - 180;
  const latNorth = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const latSouth = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return [lonWest, latSouth, lonEast, latNorth];
}

/** Approximate meters per pixel for a Web Mercator tile at a latitude. */
export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

// ---------------------------------------------------------------------------
// Color ramps
// ---------------------------------------------------------------------------

export const TERRAIN_RAMP: ColorStop[] = [
  [0.0, 58, 110, 58, 255], // lowland green
  [0.25, 124, 160, 90, 255], // yellow-green
  [0.45, 205, 185, 125, 255], // tan
  [0.65, 155, 115, 85, 255], // brown
  [0.85, 215, 215, 215, 255], // light gray
  [1.0, 255, 255, 255, 255], // white peaks
];

export const FLOOD_RAMP: ColorStop[] = [
  [0.0, 173, 216, 255, 90], // shallow — translucent light blue
  [0.5, 70, 130, 220, 165], // mid — steel blue
  [1.0, 10, 40, 140, 225], // deep — dark blue
];

/**
 * Build a 256-entry RGBA lookup texture from color stops.
 * Stops are sorted by position; values outside [0,1] are clamped.
 */
export function buildRampLUT(stops: ColorStop[]): Uint8Array {
  const sorted = [...stops].sort((a, b) => a[0] - b[0]);
  const lut = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = sorted[0];
    let b = sorted[sorted.length - 1];
    for (let s = 0; s < sorted.length - 1; s++) {
      if (t >= sorted[s][0] && t <= sorted[s + 1][0]) {
        a = sorted[s];
        b = sorted[s + 1];
        break;
      }
    }
    const span = b[0] - a[0];
    const f = span <= 0 ? 0 : (t - a[0]) / span;
    lut[i * 4] = Math.round(a[1] + (b[1] - a[1]) * f);
    lut[i * 4 + 1] = Math.round(a[2] + (b[2] - a[2]) * f);
    lut[i * 4 + 2] = Math.round(a[3] + (b[3] - a[3]) * f);
    lut[i * 4 + 3] = Math.round(a[4] + (b[4] - a[4]) * f);
  }
  return lut;
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

export const QUAD_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const RASTER_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_elev;   // R32F elevation, meters
uniform sampler2D u_ramp;   // 256x1 RGBA lookup
uniform float u_minElev;
uniform float u_maxElev;
uniform int u_mode;         // 0 = elevation, 1 = hillshade, 2 = flood
uniform float u_floodLevel;  // water surface elevation, meters
uniform float u_maxDepth;    // depth that maps to full ramp
uniform vec3 u_sunDir;       // normalized sun direction (east, north, up)
uniform vec2 u_metersPerTexel;
uniform float u_texel;       // 1 / texture width
out vec4 outColor;

float elevAt(vec2 uv) {
  return texture(u_elev, uv).r;
}

void main() {
  float e = elevAt(v_uv);
  if (isnan(e)) discard;

  if (u_mode == 0) {
    float t = clamp((e - u_minElev) / max(u_maxElev - u_minElev, 1e-6), 0.0, 1.0);
    outColor = texture(u_ramp, vec2(t, 0.5));
  } else if (u_mode == 1) {
    float dx = (elevAt(v_uv + vec2(u_texel, 0.0)) - elevAt(v_uv - vec2(u_texel, 0.0)))
             / (2.0 * u_metersPerTexel.x);
    float dy = (elevAt(v_uv + vec2(0.0, u_texel)) - elevAt(v_uv - vec2(0.0, u_texel)))
             / (2.0 * u_metersPerTexel.y);
    vec3 n = normalize(vec3(-dx, -dy, 1.0));
    float shade = clamp(dot(n, u_sunDir), 0.0, 1.0);
    // Ambient + diffuse keeps valleys readable instead of pitch black.
    float v = 0.25 + 0.75 * shade;
    outColor = vec4(vec3(v), 1.0);
  } else {
    float depth = u_floodLevel - e;
    if (depth <= 0.0) discard;
    float t = clamp(depth / max(u_maxDepth, 1e-6), 0.0, 1.0);
    outColor = texture(u_ramp, vec2(t, 0.5));
  }
}
`;

/** Minimal WebGL2 interface subset used by this module (also the mock shape). */
export interface GL2Like {
  VERTEX_SHADER: number;
  FRAGMENT_SHADER: number;
  COMPILE_STATUS: number;
  LINK_STATUS: number;
  TEXTURE_2D: number;
  TEXTURE0: number;
  TEXTURE1: number;
  RGBA: number;
  RGBA8: number;
  R32F: number;
  RED: number;
  FLOAT: number;
  UNSIGNED_BYTE: number;
  NEAREST: number;
  TEXTURE_MIN_FILTER: number;
  TEXTURE_MAG_FILTER: number;
  TEXTURE_WRAP_S: number;
  TEXTURE_WRAP_T: number;
  CLAMP_TO_EDGE: number;
  TRIANGLE_STRIP: number;
  ARRAY_BUFFER: number;
  STATIC_DRAW: number;
  COLOR_BUFFER_BIT: number;
  BLEND: number;
  SRC_ALPHA: number;
  ONE_MINUS_SRC_ALPHA: number;
  createShader(type: number): WebGLShader | null;
  shaderSource(shader: WebGLShader, source: string): void;
  compileShader(shader: WebGLShader): void;
  getShaderParameter(shader: WebGLShader, pname: number): unknown;
  getShaderInfoLog(shader: WebGLShader): string | null;
  deleteShader(shader: WebGLShader): void;
  createProgram(): WebGLProgram | null;
  attachShader(program: WebGLProgram, shader: WebGLShader): void;
  linkProgram(program: WebGLProgram): void;
  getProgramParameter(program: WebGLProgram, pname: number): unknown;
  getProgramInfoLog(program: WebGLProgram): string | null;
  deleteProgram(program: WebGLProgram): void;
  getUniformLocation(program: WebGLProgram, name: string): WebGLUniformLocation | null;
  getAttribLocation(program: WebGLProgram, name: string): number;
  createTexture(): WebGLTexture | null;
  bindTexture(target: number, texture: WebGLTexture | null): void;
  texImage2D(
    target: number, level: number, internalformat: number,
    width: number, height: number, border: number,
    format: number, type: number, pixels: ArrayBufferView | null
  ): void;
  texParameteri(target: number, pname: number, param: number): void;
  activeTexture(texture: number): void;
  createBuffer(): WebGLBuffer | null;
  bindBuffer(target: number, buffer: WebGLBuffer | null): void;
  bufferData(target: number, data: ArrayBufferView, usage: number): void;
  enableVertexAttribArray(index: number): void;
  vertexAttribPointer(
    index: number, size: number, type: number,
    normalized: boolean, stride: number, offset: number
  ): void;
  useProgram(program: WebGLProgram | null): void;
  uniform1i(location: WebGLUniformLocation | null, v: number): void;
  uniform1f(location: WebGLUniformLocation | null, v: number): void;
  uniform2f(location: WebGLUniformLocation | null, x: number, y: number): void;
  uniform3f(location: WebGLUniformLocation | null, x: number, y: number, z: number): void;
  viewport(x: number, y: number, w: number, h: number): void;
  clearColor(r: number, g: number, b: number, a: number): void;
  clear(mask: number): void;
  enable(cap: number): void;
  blendFunc(sfactor: number, dfactor: number): void;
  drawArrays(mode: number, first: number, count: number): void;
  deleteTexture(texture: WebGLTexture | null): void;
  deleteBuffer(buffer: WebGLBuffer | null): void;
  getExtension(name: string): unknown;
}

export function compileShader(
  gl: GL2Like,
  type: number,
  source: string
): { shader: WebGLShader } | { error: string } {
  const shader = gl.createShader(type);
  if (!shader) return { error: 'createShader returned null' };
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown compile error';
    gl.deleteShader(shader);
    return { error: log };
  }
  return { shader };
}

export function createProgram(
  gl: GL2Like,
  vsSource: string,
  fsSource: string
): { program: WebGLProgram } | { error: string } {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  if ('error' in vs) return { error: `vertex: ${vs.error}` };
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if ('error' in fs) {
    gl.deleteShader(vs.shader);
    return { error: `fragment: ${fs.error}` };
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs.shader);
    gl.deleteShader(fs.shader);
    return { error: 'createProgram returned null' };
  }
  gl.attachShader(program, vs.shader);
  gl.attachShader(program, fs.shader);
  gl.linkProgram(program);
  gl.deleteShader(vs.shader);
  gl.deleteShader(fs.shader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown link error';
    gl.deleteProgram(program);
    return { error: log };
  }
  return { program };
}

/**
 * Sun direction vector (east, north, up) from azimuth/altitude in degrees.
 * Azimuth 0 = north, 90 = east (compass convention); altitude 0 = horizon.
 */
export function computeSunDir(azimuthDeg: number, altitudeDeg: number): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180;
  const alt = (altitudeDeg * Math.PI) / 180;
  const x = Math.cos(alt) * Math.sin(az);
  const y = Math.cos(alt) * Math.cos(az);
  const z = Math.sin(alt);
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

// ---------------------------------------------------------------------------
// Tile fetching + mosaicking
// ---------------------------------------------------------------------------

export interface FetchTileResult {
  grid: ElevationGrid;
  x: number;
  y: number;
  z: number;
}

/** Decode a fetched tile response according to its encoding. */
export async function decodeTileResponse(
  response: Response,
  encoding: TileEncoding
): Promise<ElevationGrid> {
  if (encoding === 'terrarium') {
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    bitmap.close();
    return decodeTerrariumTile(img.data, bitmap.width, bitmap.height);
  }
  const buffer = await response.arrayBuffer();
  const parsed = parseGeoTIFF16Header(buffer);
  if ('error' in parsed) throw new Error(`GeoTIFF rejected: ${parsed.error}`);
  return decodeGeoTIFF16(buffer, parsed.header);
}

export async function fetchElevationTile(
  url: string,
  encoding: TileEncoding,
  x: number,
  y: number,
  z: number
): Promise<FetchTileResult | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const grid = await decodeTileResponse(response, encoding);
    return { grid, x, y, z };
  } catch {
    return null; // missing tile = gap, rendered as transparent — never fabricated
  }
}

/**
 * Mosaic decoded tiles (all same zoom) into one grid covering the tile range.
 * Tiles are 256px; missing tiles stay NaN.
 */
export function mosaicTiles(
  tiles: FetchTileResult[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tileSize = 256
): ElevationGrid {
  const cols = x1 - x0 + 1;
  const rows = y1 - y0 + 1;
  const width = cols * tileSize;
  const height = rows * tileSize;
  const data = new Float32Array(width * height).fill(NaN);
  let min = Infinity;
  let max = -Infinity;
  for (const t of tiles) {
    const ox = (t.x - x0) * tileSize;
    const oy = (t.y - y0) * tileSize;
    const g = t.grid;
    const cw = Math.min(tileSize, g.width);
    const ch = Math.min(tileSize, g.height);
    for (let r = 0; r < ch; r++) {
      for (let c = 0; c < cw; c++) {
        const v = g.data[r * g.width + c];
        data[(oy + r) * width + (ox + c)] = v;
        if (!Number.isNaN(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
  }
  return {
    data,
    width,
    height,
    min: min === Infinity ? NaN : min,
    max: max === -Infinity ? NaN : max,
  };
}

// ---------------------------------------------------------------------------
// GeoTIFFRenderer — raw WebGL2
// ---------------------------------------------------------------------------

export interface RendererOptions {
  /** Water surface elevation in meters (flood mode). Required for flood. */
  floodLevel?: number;
  /** Depth (m) mapped to the deep end of the flood ramp. Default 5. */
  maxDepth?: number;
  /** Sun azimuth degrees for hillshade. Default 315 (NW). */
  sunAzimuth?: number;
  /** Sun altitude degrees for hillshade. Default 45. */
  sunAltitude?: number;
  /** Custom terrain ramp stops. */
  terrainRamp?: ColorStop[];
  /** Custom flood ramp stops. */
  floodRamp?: ColorStop[];
}

const MODE_INDEX: Record<RenderMode, number> = {
  elevation: 0,
  hillshade: 1,
  flood: 2,
};

export class GeoTIFFRenderer {
  private gl: GL2Like | null = null;
  private program: WebGLProgram | null = null;
  private elevTex: WebGLTexture | null = null;
  private rampTex: WebGLTexture | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private gridWidth = 0;
  private gridHeight = 0;
  private mode: RenderMode = 'elevation';
  private minElev = 0;
  private maxElev = 1;
  private floodLevel = 0;
  private maxDepth = 5;
  private sunDir: [number, number, number] = [0, 0, 1];
  private metersPerTexel: [number, number] = [1, 1];
  private terrainRamp: ColorStop[] = TERRAIN_RAMP;
  private floodRamp: ColorStop[] = FLOOD_RAMP;
  private canvas: HTMLCanvasElement | null = null;

  /** Initialize on a canvas. Returns false when WebGL2 is unavailable. */
  init(canvas: HTMLCanvasElement, options: RendererOptions = {}): boolean {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2') as unknown as GL2Like | null;
    if (!gl) return false;
    this.gl = gl;

    if (options.floodLevel !== undefined) this.floodLevel = options.floodLevel;
    if (options.maxDepth !== undefined) this.maxDepth = options.maxDepth;
    if (options.terrainRamp) this.terrainRamp = options.terrainRamp;
    if (options.floodRamp) this.floodRamp = options.floodRamp;
    this.sunDir = computeSunDir(
      options.sunAzimuth ?? 315,
      options.sunAltitude ?? 45
    );

    const prog = createProgram(gl, QUAD_VERTEX_SHADER, RASTER_FRAGMENT_SHADER);
    if ('error' in prog) {
      this.gl = null;
      return false;
    }
    this.program = prog.program;
    gl.useProgram(this.program);

    for (const name of [
      'u_elev', 'u_ramp', 'u_minElev', 'u_maxElev', 'u_mode',
      'u_floodLevel', 'u_maxDepth', 'u_sunDir', 'u_metersPerTexel', 'u_texel',
    ]) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }

    // Fullscreen quad: positions + UVs interleaved.
    const quad = new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
       1,  1, 1, 1,
    ]);
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(this.program, 'a_pos');
    const uvLoc = gl.getAttribLocation(this.program, 'a_uv');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

    // Elevation texture (R32F, sampled with NEAREST — no float-linear ext needed).
    this.elevTex = gl.createTexture();
    // Ramp LUT texture.
    this.rampTex = gl.createTexture();
    this.uploadRamp();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }

  get supported(): boolean {
    return this.gl !== null && this.program !== null;
  }

  private uploadRamp(): void {
    const gl = this.gl;
    if (!gl || !this.rampTex) return;
    const stops = this.mode === 'flood' ? this.floodRamp : this.terrainRamp;
    const lut = buildRampLUT(stops);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.rampTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /** Upload an elevation grid. NaN = missing data (rendered transparent). */
  setElevationData(grid: ElevationGrid, metersPerTexel?: [number, number]): void {
    const gl = this.gl;
    if (!gl || !this.elevTex) return;
    this.gridWidth = grid.width;
    this.gridHeight = grid.height;
    if (metersPerTexel) this.metersPerTexel = metersPerTexel;
    if (Number.isFinite(grid.min) && Number.isFinite(grid.max)) {
      this.minElev = grid.min;
      this.maxElev = grid.max;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.elevTex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.R32F, grid.width, grid.height, 0,
      gl.RED, gl.FLOAT, grid.data
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  setMode(mode: RenderMode): void {
    if (this.mode !== mode) {
      this.mode = mode;
      this.uploadRamp(); // flood mode uses the flood LUT
    }
  }

  getMode(): RenderMode {
    return this.mode;
  }

  /** Explicit water-surface elevation in meters (human authority). */
  setFloodLevel(levelMeters: number): void {
    this.floodLevel = levelMeters;
  }

  setSunAngles(azimuthDeg: number, altitudeDeg: number): void {
    this.sunDir = computeSunDir(azimuthDeg, altitudeDeg);
  }

  setElevationRange(min: number, max: number): void {
    this.minElev = min;
    this.maxElev = max;
  }

  render(): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.canvas || this.gridWidth === 0) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (this.canvas.width !== this.canvas.clientWidth || this.canvas.height !== this.canvas.clientHeight) {
      // Keep drawing buffer in sync with CSS size (cap at 2048 for perf).
      const cw = Math.min(this.canvas.clientWidth || w, 2048);
      const ch = Math.min(this.canvas.clientHeight || h, 2048);
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.elevTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.rampTex);
    gl.uniform1i(this.uniforms['u_elev'], 0);
    gl.uniform1i(this.uniforms['u_ramp'], 1);
    gl.uniform1f(this.uniforms['u_minElev'], this.minElev);
    gl.uniform1f(this.uniforms['u_maxElev'], this.maxElev);
    gl.uniform1i(this.uniforms['u_mode'], MODE_INDEX[this.mode]);
    gl.uniform1f(this.uniforms['u_floodLevel'], this.floodLevel);
    gl.uniform1f(this.uniforms['u_maxDepth'], this.maxDepth);
    gl.uniform3f(this.uniforms['u_sunDir'], this.sunDir[0], this.sunDir[1], this.sunDir[2]);
    gl.uniform2f(this.uniforms['u_metersPerTexel'], this.metersPerTexel[0], this.metersPerTexel[1]);
    gl.uniform1f(this.uniforms['u_texel'], 1 / Math.max(this.gridWidth, 1));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.elevTex) gl.deleteTexture(this.elevTex);
    if (this.rampTex) gl.deleteTexture(this.rampTex);
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
    if (this.program) gl.deleteProgram(this.program);
    this.gl = null;
    this.program = null;
    this.elevTex = null;
    this.rampTex = null;
    this.quadBuffer = null;
  }
}

// ---------------------------------------------------------------------------
// MapLibre integration
// ---------------------------------------------------------------------------

export interface GeoTIFFLayerOptions {
  /** Tile URL template with {z}/{x}/{y}. */
  tileUrl: string;
  encoding?: TileEncoding;
  /** Initial render mode. */
  mode?: RenderMode;
  /** Initial water-surface elevation in meters (flood mode). */
  floodLevel?: number;
  /** Max tiles per axis fetched for the viewport (default 3 → up to 9 tiles). */
  maxTiles?: number;
  /** Layer opacity 0..1 (default 0.85). */
  opacity?: number;
  /** Called with a human-readable status string (loading, errors, tile gaps). */
  onStatus?: (status: string) => void;
}

export interface GeoTIFFLayerController {
  setMode(mode: RenderMode): void;
  setFloodLevel(levelMeters: number): void;
  refresh(): void;
  remove(): void;
}

/**
 * Add a WebGL2 raster overlay to a MapLibre map.
 *
 * The overlay is a transparent canvas stacked above the map canvas; it
 * re-renders the DEM/flood tiles covering the viewport whenever the map
 * stops moving. Missing tiles render as transparent gaps — never filled in.
 *
 * Returns a controller, or null when WebGL2 is unavailable on this device.
 */
export function addGeoTIFFLayer(
  map: maplibregl.Map,
  options: GeoTIFFLayerOptions
): GeoTIFFLayerController | null {
  const {
    tileUrl,
    encoding = 'terrarium',
    mode = 'elevation',
    floodLevel,
    maxTiles = 3,
    opacity = 0.85,
    onStatus,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.opacity = String(opacity);
  canvas.setAttribute('aria-label', 'TSM raster elevation overlay');
  const container = map.getContainer();
  container.appendChild(canvas);

  const renderer = new GeoTIFFRenderer();
  const ok = renderer.init(canvas, { floodLevel });
  if (!ok) {
    canvas.remove();
    onStatus?.('WebGL2 unavailable on this device — raster overlay disabled.');
    return null;
  }
  renderer.setMode(mode);

  let disposed = false;
  let seq = 0;

  async function refresh(): Promise<void> {
    if (disposed) return;
    const mySeq = ++seq;
    const zoom = Math.max(0, Math.round(map.getZoom()));
    const b = map.getBounds();
    const center = map.getCenter();
    const t0 = lonLatToTile(b.getWest(), b.getNorth(), zoom);
    const t1 = lonLatToTile(b.getEast(), b.getSouth(), zoom);
    // Clamp the tile window so one pan can't trigger a tile stampede.
    let x0 = Math.max(t0.x, t1.x - (maxTiles - 1));
    let x1 = Math.min(t1.x, t0.x + (maxTiles - 1));
    let y0 = Math.max(t0.y, t1.y - (maxTiles - 1));
    let y1 = Math.min(t1.y, t0.y + (maxTiles - 1));
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];

    onStatus?.(`Loading ${(x1 - x0 + 1) * (y1 - y0 + 1)} raster tiles (z${zoom})…`);
    const jobs: Promise<FetchTileResult | null>[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const url = tileUrl
          .replace('{z}', String(zoom))
          .replace('{x}', String(x))
          .replace('{y}', String(y));
        jobs.push(fetchElevationTile(url, encoding, x, y, zoom));
      }
    }
    const results = await Promise.all(jobs);
    if (disposed || mySeq !== seq) return; // superseded by a newer refresh
    const tiles = results.filter((r): r is FetchTileResult => r !== null);
    if (tiles.length === 0) {
      onStatus?.('No raster tiles available for this view.');
      return;
    }
    const grid = mosaicTiles(tiles, x0, y0, x1, y1);
    const mpp = metersPerPixel(center.lat, zoom) * 256 / 256; // meters per grid texel
    renderer.setElevationData(grid, [mpp, mpp]);
    renderer.render();
    const missing = (x1 - x0 + 1) * (y1 - y0 + 1) - tiles.length;
    onStatus?.(
      missing > 0
        ? `Rendered ${tiles.length} tiles; ${missing} missing (shown transparent).`
        : `Rendered ${tiles.length} tiles.`
    );
  }

  const onMoveEnd = (): void => {
    void refresh();
  };
  const onResize = (): void => {
    renderer.render();
  };
  map.on('moveend', onMoveEnd);
  map.on('resize', onResize);
  void refresh();

  return {
    setMode(m: RenderMode) {
      renderer.setMode(m);
      renderer.render();
    },
    setFloodLevel(levelMeters: number) {
      renderer.setFloodLevel(levelMeters);
      renderer.render();
    },
    refresh() {
      void refresh();
    },
    remove() {
      disposed = true;
      map.off('moveend', onMoveEnd);
      map.off('resize', onResize);
      renderer.dispose();
      canvas.remove();
    },
  };
}
