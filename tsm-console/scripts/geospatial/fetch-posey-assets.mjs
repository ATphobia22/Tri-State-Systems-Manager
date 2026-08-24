#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT_DEFAULT = path.join(ROOT, 'data/geospatial/cache/posey-2020');
const BOUNDS = Object.freeze({ minX: 2680000, minY: 940000, maxX: 2685000, maxY: 945000 });
const DEM_SERVICE = 'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_2016_2020_DEM/ImageServer/exportImage';
const NAIP_SERVICE = 'https://imagery.geoplatform.gov/iipp/rest/services/NAIP/NAIP2020_CONUS/ImageServer/exportImage';

function parseArgs(argv) {
  const args = { output: OUTPUT_DEFAULT, overwrite: false, width: 2048, height: 2048 };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--overwrite') args.overwrite = true;
    else if (token === '--output') args.output = path.resolve(argv[++index]);
    else if (token === '--width') args.width = Number(argv[++index]);
    else if (token === '--height') args.height = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!Number.isInteger(args.width) || args.width < 256 || args.width > 8192) throw new RangeError('--width must be 256..8192');
  if (!Number.isInteger(args.height) || args.height < 256 || args.height > 8192) throw new RangeError('--height must be 256..8192');
  return args;
}

function assertBounds(bounds) {
  if (bounds.minX < BOUNDS.minX || bounds.minY < BOUNDS.minY || bounds.maxX > BOUNDS.maxX || bounds.maxY > BOUNDS.maxY) {
    throw new RangeError('Requested AOI exceeds the registered Posey site bounds');
  }
}

function exportUrl(service, format, width, height) {
  const params = new URLSearchParams({
    bbox: `${BOUNDS.minX},${BOUNDS.minY},${BOUNDS.maxX},${BOUNDS.maxY}`,
    bboxSR: '2966',
    imageSR: '2966',
    size: `${width},${height}`,
    format,
    pixelType: format === 'tiff' ? 'F32' : 'U8',
    interpolation: 'RSP_Bilinear',
    f: 'image',
  });
  return `${service}?${params.toString()}`;
}

async function download(url, destination, overwrite) {
  if (!overwrite) {
    try {
      await readFile(destination);
      return { skipped: true, bytes: (await readFile(destination)).byteLength, sha256: sha256(await readFile(destination)) };
    } catch {
      // Materialize below.
    }
  }
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Asset fetch failed (${response.status}): ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(destination, bytes);
  return { skipped: false, bytes: bytes.byteLength, sha256: sha256(bytes) };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function main() {
  const args = parseArgs(process.argv);
  assertBounds(BOUNDS);
  await mkdir(args.output, { recursive: true });

  const terrainUrl = exportUrl(DEM_SERVICE, 'tiff', args.width, args.height);
  const orthophotoUrl = exportUrl(NAIP_SERVICE, 'jpgpng', args.width, args.height);
  const terrainPath = path.join(args.output, 'posey-2020-terrain-epsg2966-navd88.tif');
  const orthophotoPath = path.join(args.output, 'posey-2020-naip-epsg2966.png');

  const [terrain, orthophoto] = await Promise.all([
    download(terrainUrl, terrainPath, args.overwrite),
    download(orthophotoUrl, orthophotoPath, args.overwrite),
  ]);

  const manifest = {
    generatedAt: new Date().toISOString(),
    siteBounds: BOUNDS,
    horizontalCrs: 'EPSG:2966',
    verticalDatum: 'NAVD88',
    assets: {
      terrain: {
        path: path.relative(ROOT, terrainPath),
        sourceUri: DEM_SERVICE,
        requestUri: terrainUrl,
        bytes: terrain.bytes,
        sha256: terrain.sha256,
        authorityClass: 'OBSERVATION',
        derivationClass: 'RAW',
      },
      orthophoto: {
        path: path.relative(ROOT, orthophotoPath),
        sourceUri: NAIP_SERVICE,
        requestUri: orthophotoUrl,
        bytes: orthophoto.bytes,
        sha256: orthophoto.sha256,
        authorityClass: 'OBSERVATION',
        derivationClass: 'RAW',
      },
    },
    referenceLidarUri: 'https://lidar.digitalforestry.org/QL2_3DEP_LiDAR_IN_2017_2019/Posey_Co_2020_3DEP/Elev20_LAS1.4SPW_IN/IN2020_26800940_12.las',
  };

  await writeFile(path.join(args.output, 'asset-download-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(manifest, null, 2));
}

await main();
