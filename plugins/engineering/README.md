# @tsm/plugin-engineering

UACF plugin scaffold — engineering (v0.1.0).

**Status:** manifest only. Capabilities are declared in `src/index.ts` but every
invocation throws fail-closed ("not configured") until an operator wires the
plugin. Nothing here fabricates results.

## Declared capabilities

- `deterministic-kernels`
- `solver-envelopes`
- `evidence-pipeline`

## Rules

- Missing configuration stays unavailable; never substitute synthetic behavior.
- All outputs must carry provenance (source, version, timestamp) once wired.
