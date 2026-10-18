/**
 * Tests for the WebGL2 GeoTIFF renderer.
 * Pure logic (decoding, tile math, ramps, TIFF parsing) is tested directly.
 * Shader compilation is tested against a mock WebGL2 context.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  decodeTerrariumPixel,
  decodeTerrariumTile,
  parseGeoTIFF16Header,
  decodeGeoTIFF16,
  lonLatToTile,
  tileToBounds,
  metersPerPixel,
  buildRampLUT,
  TERRAIN_RAMP,
  FLOOD_RAMP,
  compileShader,
  createProgram,
  computeSunDir,
  mosaicTiles,
  QUAD_VERTEX_SHADER,
  RASTER_FRAGMENT_SHADER,
  GeoTIFFRenderer,
  type GL2Like,
  type FetchTileResult,
} from '../lib/geotiff-renderer';

// ---------------------------------------------------------------------------
// Terrarium decoding
// ---------------------------------------------------------------------------

describe('decodeTerrariumPixel', () => {
  it('decodes sea level (128, 0, 0) to 0 m', () => {
    expect(decodeTerrariumPixel(128, 0, 0)).toBe(0);
  });

  it('decodes (0, 0, 0) to -32768 m', () => {
    expect(decodeTerrariumPixel(0, 0, 0)).toBe(-32768);
  });

  it('decodes fractional blue channel', () => {
    // R=128, G=1, B=128 → 0*256... = 128*256 + 1 + 0.5 - 32768 = 1.5
    expect(decodeTerrariumPixel(128, 1, 128)).toBeCloseTo(1.5, 6);
  });
});

describe('decodeTerrariumTile', () => {
  it('decodes a 2x1 tile and computes min/max', () => {
    const rgba = new Uint8ClampedArray([
      128, 0, 0, 255, // 0 m
      129, 0, 0, 255, // 256 m
    ]);
    const grid = decodeTerrariumTile(rgba, 2, 1);
    expect(grid.width).toBe(2);
    expect(grid.height).toBe(1);
    expect(grid.data[0]).toBe(0);
    expect(grid.data[1]).toBe(256);
    expect(grid.min).toBe(0);
    expect(grid.max).toBe(256);
  });
});

// ---------------------------------------------------------------------------
// Minimal GeoTIFF parsing — synthetic little-endian 16-bit single-strip TIFF
// ---------------------------------------------------------------------------

/** Build a minimal 2x2 uint16 uncompressed little-endian TIFF. */
function buildTestTIFF(pixels: number[], bigEndian = false, compression = 1): ArrayBuffer {
  const w = 2;
  const h = 2;
  const entryCount = 6;
  const ifdSize = 2 + entryCount * 12 + 4;
  const pixelOffset = 8 + ifdSize;
  const buf = new ArrayBuffer(pixelOffset + pixels.length * 2);
  const view = new DataView(buf);
  const le = !bigEndian;
  const setU16 = (o: number, v: number) => view.setUint16(o, v, le);
  const setU32 = (o: number, v: number) => view.setUint32(o, v, le);
  // Header
  view.setUint8(0, bigEndian ? 0x4d : 0x49);
  view.setUint8(1, bigEndian ? 0x4d : 0x49);
  setU16(2, 42);
  setU32(4, 8);
  // IFD
  setU16(8, entryCount);
  const entry = (i: number, tag: number, type: number, count: number, value: number) => {
    const o = 10 + i * 12;
    setU16(o, tag);
    setU16(o + 2, type);
    setU32(o + 4, count);
    setU32(o + 8, value);
  };
  entry(0, 256, 3, 1, w); // ImageWidth SHORT
  entry(1, 257, 3, 1, h); // ImageLength SHORT
  entry(2, 258, 3, 1, 16); // BitsPerSample SHORT
  entry(3, 259, 3, 1, compression); // Compression SHORT
  entry(4, 273, 4, 1, pixelOffset); // StripOffsets LONG
  entry(5, 279, 4, 1, pixels.length * 2); // StripByteCounts LONG
  setU32(10 + entryCount * 12, 0); // next IFD = none
  pixels.forEach((p, i) => view.setUint16(pixelOffset + i * 2, p, le));
  return buf;
}

describe('parseGeoTIFF16Header', () => {
  it('parses a valid minimal TIFF', () => {
    const buf = buildTestTIFF([100, 200, 300, 400]);
    const res = parseGeoTIFF16Header(buf);
    expect('header' in res).toBe(true);
    if ('header' in res) {
      expect(res.header.width).toBe(2);
      expect(res.header.height).toBe(2);
      expect(res.header.sampleFormat).toBe(1);
    }
  });

  it('rejects big-endian TIFF', () => {
    const buf = buildTestTIFF([1, 2, 3, 4], true);
    const res = parseGeoTIFF16Header(buf);
    expect('error' in res).toBe(true);
  });

  it('rejects compressed TIFF', () => {
    const buf = buildTestTIFF([1, 2, 3, 4], false, 5);
    const res = parseGeoTIFF16Header(buf);
    expect('error' in res).toBe(true);
    if ('error' in res) expect(res.error).toMatch(/uncompressed/);
  });

  it('rejects a truncated buffer', () => {
    const res = parseGeoTIFF16Header(new ArrayBuffer(4));
    expect('error' in res).toBe(true);
  });
});

describe('decodeGeoTIFF16', () => {
  it('decodes uint16 pixel values', () => {
    const buf = buildTestTIFF([100, 200, 300, 400]);
    const res = parseGeoTIFF16Header(buf);
    expect('header' in res).toBe(true);
    if ('header' in res) {
      const grid = decodeGeoTIFF16(buf, res.header);
      expect(Array.from(grid.data)).toEqual([100, 200, 300, 400]);
      expect(grid.min).toBe(100);
      expect(grid.max).toBe(400);
    }
  });
});

// ---------------------------------------------------------------------------
// Tile math
// ---------------------------------------------------------------------------

describe('lonLatToTile / tileToBounds', () => {
  it('maps (0,0) at zoom 0 to tile (0,0)', () => {
    expect(lonLatToTile(0, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('round-trips tile bounds through tile lookup', () => {
    const z = 10;
    const t = lonLatToTile(-88.005075, 37.845887, z); // TSM anchor area
    const [w, s, e, n] = tileToBounds(t.x, t.y, z);
    expect(-88.005075).toBeGreaterThanOrEqual(w);
    expect(-88.005075).toBeLessThan(e);
    expect(37.845887).toBeGreaterThanOrEqual(s);
    expect(37.845887).toBeLessThan(n);
  });

  it('clamps out-of-range coordinates', () => {
    const t = lonLatToTile(200, 0, 2);
    expect(t.x).toBe(3); // max tile at z2
  });
});

describe('metersPerPixel', () => {
  it('is ~156543 at equator zoom 0', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(156543.03392, 3);
  });

  it('shrinks toward the poles', () => {
    expect(metersPerPixel(60, 0)).toBeLessThan(metersPerPixel(0, 0));
  });
});

// ---------------------------------------------------------------------------
// Color ramps
// ---------------------------------------------------------------------------

describe('buildRampLUT', () => {
  it('produces a 256-entry RGBA LUT', () => {
    const lut = buildRampLUT(TERRAIN_RAMP);
    expect(lut.length).toBe(1024);
  });

  it('matches stop colors at the endpoints', () => {
    const lut = buildRampLUT(TERRAIN_RAMP);
    // First entry ≈ first stop (58, 110, 58, 255)
    expect(lut[0]).toBe(58);
    expect(lut[1]).toBe(110);
    expect(lut[2]).toBe(58);
    // Last entry ≈ white
    expect(lut[1020]).toBe(255);
    expect(lut[1021]).toBe(255);
    expect(lut[1022]).toBe(255);
  });

  it('flood ramp starts translucent', () => {
    const lut = buildRampLUT(FLOOD_RAMP);
    expect(lut[3]).toBe(90); // alpha of first stop
  });
});

// ---------------------------------------------------------------------------
// Shader compilation with a mock WebGL2 context
// ---------------------------------------------------------------------------

function makeMockGL(opts: { compileOk?: boolean; linkOk?: boolean } = {}): GL2Like {
  const { compileOk = true, linkOk = true } = opts;
  const shader = {};
  const program = {};
  const mock = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    TEXTURE_2D: 0x0de1,
    TEXTURE0: 0x84c0,
    TEXTURE1: 0x84c1,
    RGBA: 0x1908,
    RGBA8: 0x8058,
    R32F: 0x822e,
    RED: 0x1903,
    FLOAT: 0x1406,
    UNSIGNED_BYTE: 0x1401,
    NEAREST: 0x2600,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    CLAMP_TO_EDGE: 0x812f,
    TRIANGLE_STRIP: 0x0005,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    COLOR_BUFFER_BIT: 0x4000,
    BLEND: 0x0be2,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    createShader: vi.fn(() => shader),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => compileOk),
    getShaderInfoLog: vi.fn(() => (compileOk ? '' : 'mock compile error')),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => program),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => linkOk),
    getProgramInfoLog: vi.fn(() => (linkOk ? '' : 'mock link error')),
    deleteProgram: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    getAttribLocation: vi.fn(() => 0),
    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    activeTexture: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    useProgram: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    enable: vi.fn(),
    blendFunc: vi.fn(),
    drawArrays: vi.fn(),
    deleteTexture: vi.fn(),
    deleteBuffer: vi.fn(),
    getExtension: vi.fn(() => null),
  };
  return mock as unknown as GL2Like;
}

describe('compileShader', () => {
  it('returns the shader when compilation succeeds', () => {
    const gl = makeMockGL();
    const res = compileShader(gl, gl.VERTEX_SHADER, QUAD_VERTEX_SHADER);
    expect('shader' in res).toBe(true);
    expect(gl.shaderSource).toHaveBeenCalled();
  });

  it('returns the info log when compilation fails', () => {
    const gl = makeMockGL({ compileOk: false });
    const res = compileShader(gl, gl.VERTEX_SHADER, 'bad shader');
    expect('error' in res).toBe(true);
    if ('error' in res) expect(res.error).toMatch(/mock compile error/);
  });

  it('the shipped shaders contain the required uniforms', () => {
    for (const name of ['u_elev', 'u_ramp', 'u_mode', 'u_floodLevel', 'u_sunDir']) {
      expect(RASTER_FRAGMENT_SHADER).toContain(name);
    }
    expect(RASTER_FRAGMENT_SHADER).toContain('isnan(e)');
    expect(RASTER_FRAGMENT_SHADER).toContain('discard');
  });
});

describe('createProgram', () => {
  it('links a program from the shipped shader sources', () => {
    const gl = makeMockGL();
    const res = createProgram(gl, QUAD_VERTEX_SHADER, RASTER_FRAGMENT_SHADER);
    expect('program' in res).toBe(true);
  });

  it('reports link failure with the info log', () => {
    const gl = makeMockGL({ linkOk: false });
    const res = createProgram(gl, QUAD_VERTEX_SHADER, RASTER_FRAGMENT_SHADER);
    expect('error' in res).toBe(true);
    if ('error' in res) expect(res.error).toMatch(/mock link error/);
  });
});

// ---------------------------------------------------------------------------
// Sun + mosaic
// ---------------------------------------------------------------------------

describe('computeSunDir', () => {
  it('points straight up at altitude 90', () => {
    const [x, y, z] = computeSunDir(315, 90);
    expect(z).toBeCloseTo(1, 6);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
  });

  it('points north at azimuth 0, low altitude', () => {
    const [x, y, z] = computeSunDir(0, 10);
    expect(y).toBeGreaterThan(0.9);
    expect(Math.abs(x)).toBeLessThan(0.01);
    expect(z).toBeGreaterThan(0);
  });
});

describe('mosaicTiles', () => {
  function tile(x: number, y: number, v: number): FetchTileResult {
    return {
      x, y, z: 10,
      grid: { data: new Float32Array(4).fill(v), width: 2, height: 2, min: v, max: v },
    };
  }

  it('stitches tiles into one grid at the right offsets', () => {
    const grid = mosaicTiles([tile(0, 0, 10), tile(1, 0, 20)], 0, 0, 1, 0, 2);
    expect(grid.width).toBe(4);
    expect(grid.height).toBe(2);
    expect(grid.data[0]).toBe(10); // left tile
    expect(grid.data[2]).toBe(20); // right tile starts at column 2
    expect(grid.min).toBe(10);
    expect(grid.max).toBe(20);
  });

  it('leaves missing tiles as NaN', () => {
    const grid = mosaicTiles([tile(0, 0, 5)], 0, 0, 1, 0, 2);
    expect(Number.isNaN(grid.data[3])).toBe(true);
    expect(grid.data[0]).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Renderer lifecycle with mocked canvas
// ---------------------------------------------------------------------------

describe('GeoTIFFRenderer', () => {
  it('init returns false when WebGL2 is unavailable', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    const r = new GeoTIFFRenderer();
    expect(r.init(canvas)).toBe(false);
    expect(r.supported).toBe(false);
  });

  it('setMode switches without a GL context (no crash)', () => {
    const r = new GeoTIFFRenderer();
    r.setMode('flood');
    expect(r.getMode()).toBe('flood');
    r.setFloodLevel(115.8);
    r.render(); // no-op without GL
    r.dispose(); // no-op without GL
  });
});
