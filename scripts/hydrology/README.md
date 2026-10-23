# Hydrology Scripts — HEC Coupled Workflows

Gated execution wrappers for HEC-HMS / HEC-RAS coupled runs with
evidence-grade provenance. Every run is driven by a validated
manifest; nothing executes without pinned versions, SHA-256 digests,
and an accountable approver.

## Files

| File | Purpose |
|------|---------|
| `run-hec-coupled-workflow.mjs` | Main entry: validates the manifest, checks platform/SHA pins, then executes the HEC-HMS → HEC-RAS handoff |
| `validate-hec-run-manifest.mjs` | Manifest schema + placeholder rejection (UNASSIGNED/UNVERIFIED/TBD values are errors, not warnings) |
| `hms-ras-handoff.py` | Hydrograph transfer adapter between HEC-HMS output and HEC-RAS input |
| `run-hec-hms.py` / `run-hec-ras.py` | Per-engine runners |
| `hec_runtime_common.py` | Shared runtime helpers |
| `fingerprint-hec-environment.py` | Records the execution environment fingerprint for the evidence trail |
| `requirements-hec-handoff.txt` | Python dependencies for the handoff |
| `tsm-evidence-store-adapter.mjs` | Transaction-safe adapter (`ADAPTER_VERSION 1.0.0`) that commits completed-run artifacts into the TSM authoritative evidence store |

## Execution contract

```
node scripts/hydrology/run-hec-coupled-workflow.mjs <manifest.json> <workspace-dir>
```

- `GITHUB_SHA` or `TSM_SOURCE_COMMIT` must exactly match
  `manifest.source_commit` — unrecorded local execution is prohibited.
- `metadata_store` must be `run-manifest-only` or `tsm-evidence-store-adapter`.
  The adapter commits every content-addressed run artifact into the TSM
  authoritative evidence store (`tsm-console/server/store/evidence-store.mjs`)
  with `DERIVED`/`MODEL` provenance, `pending` human review, and the run
  receipt written last as the commit marker. Appends are idempotent
  (deduplicated on SHA-256) and atomic (temp-file + rename), so a failed
  commit can be safely retried; the file-backed blobs remain the source of
  truth regardless.
- HEC engines require their native platform (HEC-RAS/HEC-HMS are
  Windows executables); the manifest pins `platform` per stage.

## Standing rules

- No HEC-RAS model output is claimed as regulatory without a licensed
  PE's review and seal.
- Model 4449 (Ohio River) is ARCHIVE ONLY: NGVD29 datum, 1976-vintage
  flows — see `docs/validation/HECRAS-4449-*`.
- Resilient, never fail-closed: missing inputs produce honest
  PROVISIONAL/UNAVAILABLE labels, never invented values.
