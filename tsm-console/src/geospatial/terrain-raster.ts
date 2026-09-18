import { fromArrayBuffer } from 'geotiff';

export interface TerrainRaster {
  readonly width: number;
  readonly height: number;
  readonly bounds: readonly [number, number, number, number];
  readonly elevations: Float32Array;
  readonly crs: 'EPSG:2966';
  readonly verticalDatum: string | null;
}

export async function decodeTerrainGeoTiff(buffer: ArrayBuffer): Promise<TerrainRaster> {
  const tiff = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox();
  const geoKeys = image.getGeoKeys();

  if (!geoKeys) throw new RangeError('terrain GeoTIFF is missing GeoTIFF CRS metadata.');
  const projectedCrs = geoKeys.ProjectedCSTypeGeoKey;
  if (projectedCrs !== 2966) {
    throw new RangeError(
      `terrain GeoTIFF CRS mismatch: expected EPSG:2966, got ${String(projectedCrs)}`,
    );
  }

  const rasters = await image.readRasters({ interleave: true });
  const elevations = new Float32Array(rasters.length);
  for (let index = 0; index < rasters.length; index += 1) {
    const value = Number(rasters[index]);
    if (!Number.isFinite(value)) {
      throw new RangeError(`terrain raster contains a non-finite elevation at index ${index}`);
    }
    elevations[index] = value;
  }

  if (bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) {
    throw new RangeError('terrain GeoTIFF has invalid georeferenced bounds');
  }
  if (elevations.length !== width * height) {
    throw new RangeError('terrain GeoTIFF dimensions do not match raster sample count');
  }

  // GeoTIFF vertical keys are preserved by geotiff.js when present, but TSM
  // does not infer NAVD88 from the absence/presence of those keys. Vertical
  // datum is populated only after an authoritative source/product mapping.
  const verticalDatum = null;

  return {
    width,
    height,
    bounds: [bbox[0], bbox[1], bbox[2], bbox[3]],
    elevations,
    crs: 'EPSG:2966',
    verticalDatum,
  };
}
