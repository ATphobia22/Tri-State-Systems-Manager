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
