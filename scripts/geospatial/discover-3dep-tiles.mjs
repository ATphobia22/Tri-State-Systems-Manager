#!/usr/bin/env node
/**
 * Discover USGS 3DEP downloadable GeoTIFF products via TNMAccess for an AOI.
 * Does not download bulk data — prints title, size, downloadURL, publicationDate.
 *
 * Usage:
 *   node scripts/geospatial/discover-3dep-tiles.mjs
 *   node scripts/geospatial/discover-3dep-tiles.mjs --bbox=-88.1,37.8,-87.9,38.0
 */
const bbox = process.argv.find((a) => a.startsWith('--bbox='))?.slice(7)
  || '-88.12,37.78,-87.88,38.12'; // default: Posey / Bonebank vicinity

const url = new URL('https://tnmaccess.nationalmap.gov/api/v1/products');
url.searchParams.set('bbox', bbox);
url.searchParams.set('prodFormats', 'GeoTIFF');
url.searchParams.set('max', '25');
// Dataset title must match TNM catalog strings; leave broad and filter client-side.

const res = await fetch(url);
if (!res.ok) {
  console.error('TNMAccess HTTP', res.status);
  process.exit(1);
}
const body = await res.json();
const items = (body.items || []).filter((it) => {
  const title = String(it.title || '');
  const url = String(it.downloadURL || '');
  return (
    /1\/3\s*Arc|1-3|\/13\/TIFF/i.test(title + url) ||
    /Elevation\/13\//.test(url)
  );
});
// If filter empty, still show a sample of elevation products for operator inspection.
const display = items.length
  ? items
  : (body.items || []).filter((it) => /Elevation|DEM|3DEP/i.test(String(it.title || ''))).slice(0, 15);

console.log(JSON.stringify({
  bbox,
  total: body.total,
  matched_13: items.length,
  items: display.slice(0, 15).map((it) => ({
    title: it.title,
    publicationDate: it.publicationDate,
    sizeInBytes: it.sizeInBytes,
    downloadURL: it.downloadURL,
    format: it.format,
  })),
  s3_current_pattern:
    'https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/{tile}/USGS_13_{tile}.tif',
  note: 'Prefer current/ staged tiles for production builds; record SHA-256 in terrain-rgb-evidence-manifest.json',
}, null, 2));
