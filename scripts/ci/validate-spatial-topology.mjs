import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..', '..');
const sql = fs.readFileSync(path.join(root, 'ops/postgis/migrations/20260919_engineering_topology.sql'), 'utf8');
const required = [
  'CREATE EXTENSION IF NOT EXISTS postgis',
  'CREATE SCHEMA IF NOT EXISTS engineering',
  'geometry(Polygon, 2966)',
  'geometry(MultiPolygon, 2966)',
  'USING GIST',
  'ST_IsValid',
  'ST_Intersects',
  'ST_Intersection',
  'review_status',
  'source_content_sha256',
  'engineering_reference_token',
  'calculate_zone_intersection_metrics',
];
const errors = [];
for (const token of required) if (!sql.includes(token)) errors.push('missing required SQL contract: ' + token);
if (/\b(owner|apn|address)\b/i.test(sql)) errors.push('direct cadastral identity field detected');
if (!/ST_IsValid\(geom_boundary\)/.test(sql)) errors.push('zone validity check missing');
if (!/ST_IsValid\(geom_parcel\)/.test(sql)) errors.push('parcel validity check missing');
if (!/JOIN engineering\.parcel_footprints p\s+ON ST_Intersects/s.test(sql)) errors.push('indexed parcel/zone intersection contract missing');
if (!/p\.review_status = 'VERIFIED'/.test(sql) || !/z\.review_status = 'VERIFIED'/.test(sql)) errors.push('intersection function must be review-gated');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Spatial topology contract: PASS');
