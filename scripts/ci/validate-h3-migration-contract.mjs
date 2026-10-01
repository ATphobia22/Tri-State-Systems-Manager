import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const upPath = path.join(root, 'ops/postgis/migrations/20261001_h3_spatial_indices.sql');
const downPath = path.join(root, 'ops/postgis/migrations/20261001_h3_spatial_indices.down.sql');

const errors = [];

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing migration file: ${path.relative(root, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

const up = readRequired(upPath);
const down = readRequired(downPath);

for (const token of ['BEGIN;', 'COMMIT;', 'CREATE EXTENSION IF NOT EXISTS h3;', 'engineering.parcel_footprints', 'h3_latlng_to_cell', 'h3_index_res8']) {
  if (!up.includes(token)) errors.push(`up migration missing required token: ${token}`);
}

for (const token of ['BEGIN;', 'COMMIT;', 'DROP FUNCTION IF EXISTS engineering.get_parcel_footprints_by_h3_res8(TEXT);', 'DROP TRIGGER IF EXISTS trg_refresh_parcel_h3_res8', 'DROP INDEX IF EXISTS engineering.parcel_footprints_h3_res8_idx', 'DROP COLUMN IF EXISTS h3_index_res8']) {
  if (!down.includes(token)) errors.push(`down migration missing required token: ${token}`);
}

if (up.includes('CREATE TABLE parcels') || up.includes('ALTER TABLE parcels ')) {
  errors.push('migration targets a non-existent generic parcels table instead of the repository parcel fabric');
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, gate: 'h3-migration-contract', errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  gate: 'h3-migration-contract',
  up: path.relative(root, upPath),
  down: path.relative(root, downPath),
  note: 'Static contract validation only; no live PostgreSQL rollback was executed by this gate.',
}, null, 2));
