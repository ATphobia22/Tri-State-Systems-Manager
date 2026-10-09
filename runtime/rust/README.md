# runtime/rust

Rust worker boundary for the UACF runtime (reserved).

**Role:** future home of performance-critical native workers (e.g. tile
encoding, hashing, geometry kernels) compiled as standalone binaries and
invoked behind the capability-worker boundary.

**Boundary rules:**
- Cargo dependencies must be vendored (`cargo vendor`) for offline builds;
  see the Windows offline runtime bundle conventions.
- Workers expose a single stdin/stdout JSON envelope; no shell expansion.
- Fail-closed on timeout, oversized payload, or hash mismatch.

**Status:** scaffold — no Rust workers are registered yet.
