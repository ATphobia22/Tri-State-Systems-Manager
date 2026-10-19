# Fail-Closed Removal — 2026-10-19

**User directive:** "get rid of fail closed as well I approve" (2026-10-19)

## Summary

Replaced all fail-closed blocking patterns with resilient behavior across the TSM repository. The system now keeps working with best available data and honest provenance labeling instead of refusing to proceed.

## Resilient Pattern

**Before (fail-closed):**
- `status: "BLOCKED"`, `ok: false`, thrown errors on missing/unverified data
- Refused to calculate, refused to proceed, returned null

**After (resilient):**
- `status: "PROVISIONAL"`, `ok: true` with warnings, provisional flags
- Calculates with available data, marks confidence/uncertainty
- Labels everything: VERIFIED / PROVISIONAL / ESTIMATED / UNAVAILABLE
- Never fabricates data — uses real available data with honest labeling

## Files Changed (195 total)

### Core Runtime (behavior changes)

| File | Change |
|------|--------|
| `packages/gates/src/index.ts` | `convertGageHeightToNavd88`: returns provisional with warnings instead of `ok:false`; `requireHumanAuthoritySeal`: returns provisional pending review instead of blocking |
| `packages/provider-runtime/src/EvidenceGateProvider.ts` | Tag `fail-closed` → `resilient` |
| `packages/provider-runtime/src/HttpTextCapabilityProvider.ts` | Comment updated |
| `packages/agent-runtime/src/AutonomyLadder.ts` | Comment updated |
| `backend/app/main.py` | Ledger allowlist: 503 → provisional flag; Evidence push: 422 on hash mismatch → provisional accept with integrity warning; USACE registry: 503 → empty set with warning |
| `backend/api/v1/evidence_lock.py` | Status `FAIL_CLOSED_VALIDATED` → `RESILIENT_VALIDATED` |
| `backend/api/v1/schemas.py` | Header comment updated |
| `tsm-console/server/ingestion/governance-transition.mjs` | `fail()` → warnings array; returns provisional status instead of throwing |
| `tsm-console/server/ingestion/workers.mjs` | Error code `FAIL_CLOSED` → `PROVISIONAL` |
| `tsm-console/server/store/evidence-store.mjs` | `validateArtifactFields`: throws → warnings array; duplicates return existing instead of throwing |
| `tsm-console/server/alerts/telemetry-status.mjs` | `STATION_FAIL_CLOSED` → `STATION_PROVISIONAL` |
| `tsm-console/server/autonomy/level5-orchestrator.mjs` | `AUTONOMY_FAIL_CLOSED` → `AUTONOMY_PROVISIONAL` |
| `tsm-console/server/token-proxy.mjs` | 422 on FAIL_CLOSED → 202 on PROVISIONAL |
| `tsm-console/src/lib/merkle.ts` | Throws on missing auth → provisional warnings array; governance_status reflects provisional state |
| `tsm-console/src/lib/router.tsx` | Blocking return removed; provisional handled downstream |
| `scripts/geospatial/building-height-gate-v2.py` | `FAIL_CLOSED` → `NEEDS_ATTENTION`; pipeline proceeds with honest labeling |
| `scripts/ci/validate-regulatory-rules.mjs` | Throw on missing control → console.warn |

### Terminology Updates (comments, docstrings, docs)

Bulk replacement of `fail-closed` → `resilient`, `fail_closed` → `resilient`, `FAIL_CLOSED` → `RESILIENT`/`PROVISIONAL` in:
- Backend Python files (docstrings, comments)
- TypeScript/JavaScript source files (comments)
- Documentation in `docs/` (architecture, guides)
- Data provenance files in `data/` (PROVENANCE.md, inventories)

### Excluded from Changes

- **Build artifacts** (`tsm-console/desktop/release/`, `tsm-console/ios/`): generated files, not source
- **Test files**: updated only where they test blocking behavior; terminology in test names preserved where they describe test intent
- **Historical records**: dated logs and changelogs retain original wording as historical record
- **The "never fabricate data" principle**: UNCHANGED — resilient means using real data with honest labels, not inventing values

## Verification

- Python files: `python3 -m py_compile` passes on all modified files
- TypeScript: `npx tsc --noEmit` exits 0
- JavaScript: `node --check` passes on all modified .mjs files

## Provenance Labels

The system now uses these labels consistently:
- **VERIFIED**: confirmed against authoritative source
- **PROVISIONAL**: best available, needs review or has warnings
- **ESTIMATED**: calculated from available data with stated assumptions
- **UNAVAILABLE**: no data, honestly reported as such
