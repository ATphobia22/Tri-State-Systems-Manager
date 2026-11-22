import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../ops/martin/sql/get_parcel_tiles.sql', import.meta.url), 'utf8');

describe('anonymous public parcel MVT authorization boundary', () => {
  it('does not export owner names or site addresses to anonymous tile consumers', () => {
    expect(sql).not.toMatch(/\bp\.(?:owner_name|site_address|email|phone_number)\b/i);
    expect(sql).not.toMatch(/"(?:owner_name|site_address|email|phone_number)"/i);
    expect(sql).toMatch(/p\.parcel_id/);
    expect(sql).toMatch(/p\.evidence_sha256/);
  });

  it('rejects impossible XYZ positions before PostGIS tile envelope generation', () => {
    expect(sql).toMatch(/x\s*>=\s*\(1::bigint\s*<<\s*z\)/);
    expect(sql).toMatch(/y\s*>=\s*\(1::bigint\s*<<\s*z\)/);
  });
});
