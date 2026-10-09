# @tsm/plugin-fema

UACF plugin scaffold — fema (v0.1.0).

**Status:** manifest only. Capabilities are declared in `src/index.ts` but every
invocation throws fail-closed ("not configured") until an operator wires the
plugin. Nothing here fabricates results.

## Declared capabilities

- `nfhl-binding`
- `firm-panel-registry`
- `mt1-checklist`

## Rules

- Missing configuration stays unavailable; never substitute synthetic behavior.
- All outputs must carry provenance (source, version, timestamp) once wired.
