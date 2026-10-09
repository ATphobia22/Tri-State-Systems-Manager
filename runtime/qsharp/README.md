# runtime/qsharp

Q# worker boundary for the UACF runtime (reserved, research-only).

**Role:** placeholder for quantum-computing research workers. Any future Q#
worker would run as an isolated capability worker behind the standard
contract (allowlisted entry point, hashed I/O envelope, provenance).

**Boundary rules:**
- Research-only; results are computational, never clinical or certified.
- No Q# worker may mutate native engineering state directly.
- Fail-closed on timeout or envelope mismatch.

**Status:** scaffold — no Q# workers exist or are planned for production.
