/**
 * Strict six-parameter ESRI world-file parser.
 * A,D,B,E,C,F map pixel coordinates to map coordinates.
 */

export function parseWorldFile(text) {
  if (typeof text !== 'string') throw new TypeError('world file must be text');
  const values = text
    .trim()
    .split(/\s+/)
    .map((value) => Number(value));

  if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) {
    throw new TypeError('world file must contain exactly six finite numeric values');
  }

  const [a, d, b, e, c, f] = values;
  if (a === 0 || e === 0) throw new RangeError('world-file pixel scale cannot be zero');

  return Object.freeze({ a, d, b, e, c, f });
}

export function mapPixel(transform, column, row) {
  if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || row < 0) {
    throw new RangeError('pixel coordinates must be non-negative integers');
  }
  return {
    x: transform.a * column + transform.b * row + transform.c,
    y: transform.d * column + transform.e * row + transform.f,
  };
}

export function buildGeoreferencedExtent(transform, width, height) {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new RangeError('raster dimensions must be positive integers');
  }

  const corners = [
    mapPixel(transform, 0, 0),
    mapPixel(transform, width - 1, 0),
    mapPixel(transform, 0, height - 1),
    mapPixel(transform, width - 1, height - 1),
  ];

  return {
    minX: Math.min(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxX: Math.max(...corners.map((point) => point.x)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}
