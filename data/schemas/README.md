# TSM schemas & catalogs (canonical location)

Root-level `tsm-*.json` copies were relocated here (2026-09-02) to keep the repository root executable-clean.

| File | Purpose |
|------|---------|
| `tsm-authority-registry-v35.json` | Verified hydrologic / authority nodes |
| `tsm-data-contract-schema-v1.0.0.json` | Versioned data contract JSON Schema |
| `tsm-evidence-artifact-schema-v1.0.0.json` | EvidenceArtifact contract |
| `tsm-four-plane-architecture-v1.json` | ADR-005 plane map |
| `tsm-indiana-data-catalog-v1.json` | Indiana/federal authoritative source catalog, version 1.1.0 (2026-09-12) |
| `tsm-site-constants-13101-bonebank.json` | Bonebank site locks |

The v1 catalog filename is retained for compatibility; its internal catalog version is now `1.1.0`. Runtime code should resolve source endpoints through the server-side `source-contracts.mjs` registry rather than embedding unvalidated URLs.

Code and loaders should resolve paths under `data/schemas/` (or copy into runtime image layers explicitly).
