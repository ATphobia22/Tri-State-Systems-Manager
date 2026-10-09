# @tsm/plugin-digital-twin

UACF plugin scaffold — digital twin (v0.1.0).

**Status:** manifest only. Capabilities are declared in `src/index.ts` but every
invocation throws fail-closed ("not configured") until an operator wires the
plugin. Nothing here fabricates results.

## Declared capabilities

- `twin-layer-registration`
- `lod-gating`
- `provenance-overlay`

## Rules

- Missing configuration stays unavailable; never substitute synthetic behavior.
- All outputs must carry provenance (source, version, timestamp) once wired.
