export interface SiteBounds2966 {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export type AuthorityClass = 'OBSERVATION' | 'DERIVED';
export type DerivationClass = 'RAW' | 'DERIVED';

export interface GeospatialAsset {
  readonly assetId: string;
  readonly title: string;
  readonly sourceUri: string;
  readonly authorityClass: AuthorityClass;
  readonly derivationClass: DerivationClass;
  readonly acquisitionYear: number;
  readonly format: string;
  readonly horizontalCrs: string;
  readonly verticalDatum?: string;
  readonly referenceLidarUri?: string;
  readonly notes: string;
}

export interface PoseyAssetManifest {
  readonly manifestVersion: string;
  readonly siteId: string;
  readonly bounds: SiteBounds2966;
  readonly horizontalCrs: 'EPSG:2966';
  readonly horizontalCrsName: 'NAD83 / Indiana West (ftUS)';
  readonly verticalDatum: 'NAVD88';
  readonly terrain: GeospatialAsset & {
    readonly servicePixelSizeMeters: number;
  };
  readonly orthophoto: GeospatialAsset & {
    readonly groundSampleDistanceMeters: number;
    readonly bandCount: number;
  };
}

export const POSEY_SITE_BOUNDS: SiteBounds2966 = {
  minX: 2_680_000,
  minY: 940_000,
  maxX: 2_685_000,
  maxY: 945_000,
};

const INDIANA_DEM_IMAGE_SERVER =
  'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_2016_2020_DEM/ImageServer';

const NAIP_2020_IMAGE_SERVER =
  'https://imagery.geoplatform.gov/iipp/rest/services/NAIP/NAIP2020_CONUS/ImageServer';

const POSEY_2020_REFERENCE_LIDAR =
  'https://lidar.digitalforestry.org/QL2_3DEP_LiDAR_IN_2017_2019/Posey_Co_2020_3DEP/Elev20_LAS1.4SPW_IN/IN2020_26800940_12.las';

export const POSEY_2020_ASSETS: PoseyAssetManifest = {
  manifestVersion: '1.0.0',
  siteId: 'posey-point-township-bonebank-5000ft',
  bounds: POSEY_SITE_BOUNDS,
  horizontalCrs: 'EPSG:2966',
  horizontalCrsName: 'NAD83 / Indiana West (ftUS)',
  verticalDatum: 'NAVD88',
  terrain: {
    assetId: 'in-2016-2020-dem-posey-26800940',
    title: 'Indiana 2016–2020 hydro-flattened bare-earth DEM — Posey County',
    sourceUri: INDIANA_DEM_IMAGE_SERVER,
    referenceLidarUri: POSEY_2020_REFERENCE_LIDAR,
    authorityClass: 'OBSERVATION',
    derivationClass: 'RAW',
    acquisitionYear: 2020,
    format: 'ArcGIS ImageServer / GeoTIFF export',
    horizontalCrs: 'EPSG:2966',
    verticalDatum: 'NAVD88',
    servicePixelSizeMeters: 0.30480060960121846,
    notes:
      'Authoritative runtime terrain surface. The Purdue LAS tile is retained as source provenance/reference and is not committed to Git because it is approximately 305 MB.',
  },
  orthophoto: {
    assetId: 'usda-naip-2020-indiana-posey',
    title: 'USDA NAIP 2020 Indiana 4-band orthophoto',
    sourceUri: NAIP_2020_IMAGE_SERVER,
    authorityClass: 'OBSERVATION',
    derivationClass: 'RAW',
    acquisitionYear: 2020,
    format: 'ArcGIS ImageServer / PNG or GeoTIFF export',
    horizontalCrs: 'EPSG:2966',
    groundSampleDistanceMeters: 0.6,
    bandCount: 4,
    notes:
      '2020 USDA Farm Service Agency NAIP imagery distributed through the USGS/DOI GeoPlatform service. Runtime requests are bounded to the registered Posey AOI.',
  },
};

export function isWithinPoseyBounds(bounds: SiteBounds2966): boolean {
  return (
    bounds.minX >= POSEY_SITE_BOUNDS.minX &&
    bounds.minY >= POSEY_SITE_BOUNDS.minY &&
    bounds.maxX <= POSEY_SITE_BOUNDS.maxX &&
    bounds.maxY <= POSEY_SITE_BOUNDS.maxY &&
    bounds.minX < bounds.maxX &&
    bounds.minY < bounds.maxY
  );
}
