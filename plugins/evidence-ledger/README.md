# @tsm/plugin-evidence-ledger

UACF plugin scaffold — evidence ledger (v0.1.0).

**Status:** manifest only. Capabilities are declared in `src/index.ts` but every
invocation throws fail-closed ("not configured") until an operator wires the
plugin. Nothing here fabricates results.

## Declared capabilities

- `hash-chained-records`
- `sha256-attestation`
- `human-review-gates`

## Rules

- Missing configuration stays unavailable; never substitute synthetic behavior.
- All outputs must carry provenance (source, version, timestamp) once wired.
