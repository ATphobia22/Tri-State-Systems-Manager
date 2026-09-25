# TSM schemas & catalogs (canonical location)

Root-level `tsm-*.json` copies are maintained here so the repository remains executable-clean.

| File | Purpose |
|------|---------|
| `tsm-authority-registry-v35.json` | Verified hydrologic / authority nodes |
| `tsm-data-contract-schema-v1.0.0.json` | Versioned data contract JSON Schema |
| `tsm-evidence-artifact-schema-v1.0.0.json` | EvidenceArtifact contract |
| `tsm-four-plane-architecture-v1.json` | ADR-005 plane map |
| `tsm-indiana-data-catalog-v1.json` | Indiana/federal authoritative source catalog |
| `dredged-material.schema.json` | Dredged-material qualification gate |
| `authority-pathway.schema.json` | Conditional authority/funding pathway |
| `material-routing.schema.json` | Provenance and mass/volume routing |
| `engineering-section.schema.json` | Subsurface-to-finished-grade section |
| `historical-event.schema.json` | Privacy-safe historical replay |
| `evidence-manifest.schema.json` | Cryptographic engineering evidence manifest |

The community engineering system intentionally contains no private residence or parcel-specific site-constant schema. Runtime project geometry must come from the active community/project evidence set with explicit CRS, vertical datum, survey and provenance metadata.

Code and loaders should resolve paths under `data/schemas/` (or copy into runtime image layers explicitly).

## Schema versioning policy

- **Semver for schemas.** Every JSON Schema under `data/schemas/*.schema.json` carries an explicit version:
  versioned schemas use the filename pattern `<name>-v<N>.schema.json` (e.g. `engineering-evidence-pipeline-v1.schema.json`)
  or a `schema_version` / `schemaVersion` field with `const` pinning, and the version follows semver
  (`MAJOR.MINOR.PATCH`): MAJOR for breaking changes (removed/renamed required fields, tightened enums or
  `const`s), MINOR for additive non-breaking changes (new optional fields, new enum values),
  PATCH for documentation/clarification-only edits.
- **Migrations go in the changelog.** Any schema change that alters what validates must be recorded in
  `data/schemas/CHANGELOG.md` with the schema name, old → new version, what changed, and whether existing
  artifacts need migration. Additive changes must keep all existing examples and contract files validating;
  breaking changes require bumping MAJOR and noting the migration path.
- **One example per schema.** Every `*.schema.json` ships exactly one minimal valid example at
  `data/schemas/examples/<schema-basename>.example.json` (e.g. `authority-pathway.example.json`).
  Examples must validate against their schema — check with `python -m jsonschema -i <example> <schema>`
  (or node `ajv`). If an example fails validation, fix the example; change the schema only when the schema
  itself is genuinely wrong, and record the change in the changelog.
- **`$id` URI convention.** Schema `$id`s use either the non-resolving project URN form
  (`urn:tsm:<name>:v<N>`) or the canonical resolving base `https://tri-state-systems-manager.org/schemas/…`.
  The legacy `https://schemas.tsm-community.example/…` `$id`s are recognized but deprecated; do not mint new ones.
