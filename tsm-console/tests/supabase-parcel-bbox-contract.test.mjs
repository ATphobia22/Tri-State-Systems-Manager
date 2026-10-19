import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const parcelClient = readFileSync(
  new URL('../src/lib/supabase-parcel-bbox.ts', import.meta.url),
  'utf8',
);

const migration = readFileSync(
  new URL('../../supabase/migrations/20261019143000_posey_parcel_bbox.sql', import.meta.url),
  'utf8',
);

test('PostGIS parcel RPC is bounded, indexed, and row-security aware', () => {
  assert.match(migration, /create extension if not exists postgis with schema extensions/i);
  assert.match(migration, /grant usage on schema extensions to anon, authenticated/i);
  assert.match(migration, /using gist \(geom\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /using \(is_public = true and verification_status = 'verified'\)/i);
  assert.match(migration, /verification_status text not null default 'pending'/i);
  assert.match(migration, /p\.verification_status = 'verified'/i);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /limit 1001/i);
  assert.match(migration, /limit 1000/i);
  assert.match(migration, /'truncated'/i);
  assert.match(migration, /p_xmax - p_xmin\) > 2\.0/i);
  assert.match(migration, /st_intersects/i);
  assert.match(migration, /st_makeenvelope\(p_xmin, p_ymin, p_xmax, p_ymax, 4326\)/i);
  assert.doesNotMatch(migration, /st_makeenvelope\(xmin, ymin, xmax, ymax, 4326\)/i);
  assert.doesNotMatch(migration, /security definer/i);
  assert.doesNotMatch(migration, /\bowner\s+text\b/i);
});

test('parcel API does not grant write access to anonymous clients', () => {
  assert.match(migration, /revoke all on table public\.posey_parcels from anon, authenticated/i);
  assert.match(migration, /grant select on table public\.posey_parcels to anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.get_parcels_in_bbox/i);
});


test('parcel viewport never silently displays a truncated page', () => {
  assert.match(parcelClient, /collection\.truncated/);
  assert.match(parcelClient, /aria-live/);
  assert.match(parcelClient, /partial results are hidden/);
  assert.match(parcelClient, /no stale parcel results are shown/);
});
