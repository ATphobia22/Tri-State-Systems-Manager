# @tsm/plugin-monitoring

UACF plugin scaffold — monitoring (v0.1.0).

**Status:** manifest only. Capabilities are declared in `src/index.ts` but every
invocation throws fail-closed ("not configured") until an operator wires the
plugin. Nothing here fabricates results.

## Declared capabilities

- `health-checks`
- `metrics-snapshots`
- `staleness-detection`

## Rules

- Missing configuration stays unavailable; never substitute synthetic behavior.
- All outputs must carry provenance (source, version, timestamp) once wired.
