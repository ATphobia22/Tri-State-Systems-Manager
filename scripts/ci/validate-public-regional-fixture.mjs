#!/usr/bin/env node
/** Validate the PUBLIC demonstration fixture only. This is not a repository-wide
 * privacy clearance or a waiver for owner-approved historic publication. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function validatePublicRegionalFixture(doc) {
  const errors = [];
  const m = doc?.metadata;
  if (doc?.type !== 'FeatureCollection' || !Array.isArray(doc.features) || doc.features.length !== 1)
    errors.push('Expected one synthetic FeatureCollection feature');
  if (m?.synthetic !== true || m?.authorityClass !== 'SYNTHETIC' ||
      m?.engineeringUse !== false || m?.regulatoryUse !== false)
    errors.push('Fixture must be explicitly synthetic and barred from engineering/regulatory use');
  const f = doc?.features?.[0];
  if (f?.type !== 'Feature' || f?.properties?.aoiType !== 'REGIONAL_DEMONSTRATION' ||
      f?.properties?.authorityClass !== 'SYNTHETIC' ||
      f?.properties?.engineeringUse !== false || f?.properties?.regulatoryUse !== false)
    errors.push('Missing feature authority separation');
  const allowedProperties = new Set(['label', 'aoiType', 'source', 'authorityClass', 'engineeringUse', 'regulatoryUse']);
  for (const key of Object.keys(f?.properties ?? {})) {
    if (!allowedProperties.has(key)) errors.push('Unapproved per-feature property key: ' + key);
  }
  const values = JSON.stringify(f?.properties ?? {});
  if (/\b(?:parcel|address|owner|resident|household|phone|email|person|geotag|exif|siteAnchor|structureId)\b/i.test(values))
    errors.push('Potentially property-specific content is prohibited from this fixture');
  const g = f?.geometry;
  const rings = g?.type === 'Polygon' ? g.coordinates : undefined;
  if (!Array.isArray(rings) || rings.length !== 1 || !Array.isArray(rings[0]) || rings[0].length !== 5) {
    errors.push('Expected one rectangular region-scale polygon'); return errors;
  }
  const ring = rings[0];
  if (ring.some(p => !Array.isArray(p) || p.length !== 2 ||
      p.some(v => typeof v !== 'number' || !Number.isFinite(v)))) {
    errors.push('Invalid coordinates'); return errors;
  }
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  if (JSON.stringify(ring[0]) !== JSON.stringify(ring[ring.length - 1]))
    errors.push('Unclosed region ring');
  if (Math.max(...xs) - Math.min(...xs) < 1 || Math.max(...ys) - Math.min(...ys) < 1)
    errors.push('Extent is too narrow for the approved region-scale example');
  if (Math.min(...xs) < -180 || Math.max(...xs) > 180 ||
      Math.min(...ys) < -90 || Math.max(...ys) > 90)
    errors.push('Invalid geographic bounds');
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ?? 'data/fixtures/public-regional-aoi.synthetic.geojson';
  const errors = validatePublicRegionalFixture(JSON.parse(readFileSync(file, 'utf8')));
  if (errors.length) { console.error(JSON.stringify({ok:false,errors})); process.exitCode = 1; }
  else console.log(JSON.stringify({ok:true,classification:'SYNTHETIC_INFORMATIONAL_ONLY'}));
}
