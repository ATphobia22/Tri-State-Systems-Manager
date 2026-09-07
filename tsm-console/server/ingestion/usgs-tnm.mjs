import { requestJson } from './http-client.mjs';
import { recordSourceHealth } from './source-health.mjs';

export const TNM_ACCESS_API = 'https://tnmaccess.nationalmap.gov/api/v1/products';

export function normalizeTnmProducts(items, retrievedAt) {
  if (!Array.isArray(items)) throw new TypeError('TNM products must be an array');
  return items.map((item) => {
    const bbox = item.bbox;
    if (!item?.crs || !Array.isArray(bbox) || bbox.length !== 4 || !item?.format || !item?.downloadURL) throw new TypeError('TNM product requires CRS, bounds, format, and download URL');
    return Object.freeze({
      dataset: item.dataset || '3DEP', title: item.title, format: item.format, bbox, crs: item.crs,
      downloadURL: item.downloadURL, publicationDate: item.publicationDate || null, acquisitionDate: item.acquisitionDate || null,
      resolution: Number(item.resolution ?? item.rasterResolution ?? NaN), qualityLevel: item.qualityLevel || null,
      verticalReference: item.verticalReference || null, retrievedAt,
      dataClass: 'evidence', provenance: { provider: 'USGS National Map / 3DEP' },
    });
  });
}

export function select3depProducts(products, resolution) {
  if (!Number.isFinite(resolution) || resolution <= 0) throw new TypeError('resolution must be positive');
  return products.filter((product) => Number.isFinite(product.resolution)).sort((a, b) => Math.abs(a.resolution - resolution) - Math.abs(b.resolution - resolution));
}

export async function searchTnmProducts({ bbox, datasets = ['Lidar Point Cloud', 'Elevation Products (3DEP)'], maxItems = 100, signal, request = requestJson }) {
  if (!Array.isArray(bbox) || bbox.length !== 4) throw new TypeError('TNM bbox must contain four coordinates');
  const url = new URL(TNM_ACCESS_API);
  url.searchParams.set('bbox', bbox.join(',')); url.searchParams.set('prodFormats', 'GeoTIFF,LAZ,LAS'); url.searchParams.set('max', String(Math.min(maxItems, 1000)));
  const retrievedAt = new Date().toISOString();
  const payload = await request(url, { signal, timeoutMs: 20000, maxBytes: 5_000_000 });
  const items = payload?.items || payload?.results || [];
  const products = normalizeTnmProducts(items.filter((item) => datasets.includes(item.dataset) || datasets.includes(item.title)), retrievedAt);
  recordSourceHealth('USGS-TNM', { ok: true, recordCount: products.length });
  return products;
}

export async function select3depProductsByArea({ bbox, resolution, signal, request = requestJson }) {
  const products = await searchTnmProducts({ bbox, signal, request });
  return select3depProducts(products, resolution);
}
