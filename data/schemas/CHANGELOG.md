# TSM Data Schemas — CHANGELOG

Migration notes for schema version bumps. Entries describe what changed,
why, and whether the bump is backward compatible.

## tsm-data-contract-schema-v1.0.0.json

### 2026-09-25 (in place, version unchanged)

- `provenance.content_hash` pattern tightened from `^(sha256:)?[a-fA-F0-9]{64}$`
  to `^[a-f0-9]{64}$`: canonical hash form is now lowercase hex, 64
  characters, no `sha256:` prefix. Emitters must emit the bare lowercase
  digest; consumers (e.g. `tsm-console/src/lib/evidence.ts`) already normalize
  defensively. The embedded example was updated to the canonical form.
- New OPTIONAL top-level field `evidence_tier` (integer enum 0–6, numeric
  only). Mirrors `tier: 0|1|2|3|4|5|6` in `tsm-console/src/types/loaders.ts`.
  The labeled tier vocabulary is not defined anywhere in this repository, so
  the description explicitly forbids presenting a numeric tier as an authority
  claim. Tenant paths were deliberately NOT added: zero implementation exists.

## geospatial-tile-fabric.schema.json

### v1.0.0 → v1.1.0

- `schemaVersion` const changed `"1.0.0"` → `"1.1.0"`.
- New top-level required field `scope` (string, minLength 1): a human-readable
  statement of the geographic/operational scope the fabric covers. The
  canonical artifact `artifacts/tsm-geospatial-tile-fabric-v1.json` already
  carried this field (added during authoring) while the schema still pinned
  v1.0.0 with closed top-level properties — this bump resolves that drift.
- `authorityClass` enum gained `STATE_ELEVATION` and `STATE_DERIVED_GEOMETRY`
  (assets already using them, e.g. state elevation program products).
- `verification.state` enum gained `VERIFIED_SERVICE_METADATA` for assets
  verified via live service metadata rather than downloaded source data.
- Backward compatibility: v1.1.0 artifacts are not readable by v1.0.0
  validators (new required field + const change). v1.0.0 artifacts validate
  against v1.1.0 only if they supply a `scope` field; schemaVersion const must
  be updated by producers.
