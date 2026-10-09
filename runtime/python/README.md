# runtime/python

Python worker boundary for the UACF runtime.

**Role:** hosts the deterministic engineering computation layer — HEC-RAS
geometry helpers, GIS acquisition/validation, evidence-packet tooling, and
geospatial utilities (see `backend/`, `scripts/geospatial/`, `tools/`).

**Boundary rules:**
- Workers execute behind explicit contracts: allowlisted entry points, no
  shell expansion, explicit timeouts, hashed I/O envelopes, provenance checks.
- Missing or disallowed workers, timeouts, oversized payloads, and hash
  mismatches are failures — never reasons to fabricate a result.
- Heavy third-party stacks (CAD, CFD, numerical) are **not** embedded in the
  native runtime; they operate as capability workers behind contracts.
- Pinned dependencies only; `requirements` must be hash-pinned for releases.

This directory reserves the runtime layout; worker registration happens via
the capability fabric (`packages/capability-runtime/`).
