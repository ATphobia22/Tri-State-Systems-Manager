import manifest from '../../data/manifests/posey-2020-site-assets.json' with { type: 'json' };
import { once } from 'node:events';

const POSEY_2020_ASSETS = manifest;
const POSEY_SITE_BOUNDS = manifest.bounds;
const ALLOWED_HOSTS = new Set(['di-ingov.img.arcgis.com', 'imagery.geoplatform.gov']);
const MAX_DIMENSION = 4096;
const MAX_PIXELS = 12_000_000;
const MAX_RESPONSE_BYTES = 128 * 1024 * 1024;

function isWithinPoseyBounds(bounds) {
  return (
    bounds.minX >= POSEY_SITE_BOUNDS.minX &&
    bounds.minY >= POSEY_SITE_BOUNDS.minY &&
    bounds.maxX <= POSEY_SITE_BOUNDS.maxX &&
    bounds.maxY <= POSEY_SITE_BOUNDS.maxY &&
    bounds.minX < bounds.maxX &&
    bounds.minY < bounds.maxY
  );
}

function parseBounds(raw) {
  const values = String(raw || '').split(',').map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) throw new RangeError('bbox must be minX,minY,maxX,maxY');
  const [minX, minY, maxX, maxY] = values;
  const bounds = { minX, minY, maxX, maxY };
  if (!isWithinPoseyBounds(bounds)) throw new RangeError('bbox exceeds the registered Posey site bounds');
  return bounds;
}

function parseDimension(raw, name) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 256 || value > MAX_DIMENSION) throw new RangeError(`${name} must be an integer between 256 and ${MAX_DIMENSION}`);
  return value;
}

function buildExportUrl(sourceUri, bounds, width, height, format, pixelType, interpolation) {
  const source = new URL(sourceUri);
  if (!ALLOWED_HOSTS.has(source.hostname)) throw new Error(`Upstream host is not allowlisted: ${source.hostname}`);
  const endpoint = new URL(`${source.toString().replace(/\/$/, '')}/exportImage`);
  endpoint.searchParams.set('bbox', `${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}`);
  endpoint.searchParams.set('bboxSR', '2966');
  endpoint.searchParams.set('imageSR', '2966');
  endpoint.searchParams.set('size', `${width},${height}`);
  endpoint.searchParams.set('format', format);
  endpoint.searchParams.set('pixelType', pixelType);
  endpoint.searchParams.set('interpolation', interpolation);
  endpoint.searchParams.set('f', 'image');
  return endpoint;
}

const RASTER_FETCH_TIMEOUT_MS = 30000;

async function fetchSource(url) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(RASTER_FETCH_TIMEOUT_MS) });
  if (response.status >= 300 && response.status < 400) throw new Error('Upstream raster redirect rejected.');
  if (!response.ok) throw new Error(`Upstream raster request failed: HTTP ${response.status}`);
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  if (contentType.includes('json') || contentType.startsWith('text/')) {
    throw new Error(`Upstream raster returned an unexpected content type: ${contentType || 'unknown'}`);
  }
  const contentLength = Number(response.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new Error('Upstream raster response exceeds the configured byte budget.');
  }
  return response;
}

export function buildPoseyAssetResponse(requestUrl) {
  const url = new URL(requestUrl, 'http://localhost');
  const bounds = parseBounds(url.searchParams.get('bbox') || `${POSEY_SITE_BOUNDS.minX},${POSEY_SITE_BOUNDS.minY},${POSEY_SITE_BOUNDS.maxX},${POSEY_SITE_BOUNDS.maxY}`);
  const width = parseDimension(url.searchParams.get('width') || '1024', 'width');
  const height = parseDimension(url.searchParams.get('height') || '1024', 'height');
  if (width * height > MAX_PIXELS) throw new RangeError('requested raster exceeds maximum pixel budget');
  const kind = url.searchParams.get('kind') || 'terrain';

  if (kind === 'terrain') {
    return {
      bounds,
      width,
      height,
      contentType: 'image/tiff',
      source: POSEY_2020_ASSETS.terrain,
      upstream: buildExportUrl(POSEY_2020_ASSETS.terrain.sourceUri, bounds, width, height, 'tiff', 'F32', 'RSP_NearestNeighbor'),
    };
  }
  if (kind === 'orthophoto') {
    return {
      bounds,
      width,
      height,
      contentType: 'image/png',
      source: POSEY_2020_ASSETS.orthophoto,
      upstream: buildExportUrl(POSEY_2020_ASSETS.orthophoto.sourceUri, bounds, width, height, 'png32', 'U8', 'RSP_BilinearInterpolation'),
    };
  }
  throw new RangeError('kind must be terrain or orthophoto');
}

export async function servePoseyAsset(req, res) {
  const request = buildPoseyAssetResponse(req.url || '/');
  const response = await fetchSource(request.upstream);
  // Stream the upstream body through a byte-counting gate instead of
  // buffering the whole raster with arrayBuffer(). The content-length header
  // is spoofable, so the cap is enforced on actual bytes received; a
  // truncated or empty body destroys the connection rather than delivering a
  // silently-short image.
  res.writeHead(200, {
    'Content-Type': request.contentType,
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'http://localhost:5173',
    'X-TSM-Source-URI': request.source.sourceUri,
    'X-TSM-Reference-LiDAR-URI': POSEY_2020_ASSETS.terrain.referenceLidarUri || '',
    'X-TSM-CRS': 'EPSG:2966',
    'X-TSM-Vertical-Datum': request.source.verticalDatum || 'UNVERIFIED',
    'X-TSM-Vertical-Datum-Verified': request.source.verticalDatum ? 'true' : 'false',
    'X-TSM-Acquisition-Year': String(request.source.acquisitionYear),
    'X-TSM-Authority-Class': request.source.authorityClass,
    'X-TSM-Derivation-Class': request.source.derivationClass,
    'X-TSM-AOI': `${request.bounds.minX},${request.bounds.minY},${request.bounds.maxX},${request.bounds.maxY}`,
  });
  let totalBytes = 0;
  try {
    for await (const chunk of response.body) {
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        throw new RangeError('Upstream raster response exceeds the configured byte budget.');
      }
      if (!res.write(chunk)) await once(res, 'drain');
    }
    if (totalBytes === 0) throw new Error('Upstream raster response is empty.');
  } catch (error) {
    // Headers are already committed: fail closed by destroying the socket so
    // the client cannot mistake a truncated stream for a valid raster.
    res.destroy(error instanceof Error ? error : new Error(String(error)));
    return;
  }
  res.end();
}

export function getPoseyAssetManifest() { return structuredClone(POSEY_2020_ASSETS); }
