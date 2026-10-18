# npm audit exceptions

**Reviewed:** 2026-10-18  
**Owner:** TSM engineering / release-gate maintainer  
**Status:** one temporary, narrowly-scoped exception; not a claim that the dependency is patched.

## GHSA-vfj7-8cjw-p6xm — braces stack-exhaustion advisory

The current npm audit database reports GHSA-vfj7-8cjw-p6xm against `braces@3.0.3`, affecting a developer-tooling path:

```text
@gltf-transform/cli@4.5.1 [dev dependency]
  -> micromatch@4.0.8 [dev-only]
    -> braces@3.0.3 [dev-only]
```

At review time, the [GitHub Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version. The upstream [braces issue](https://github.com/micromatch/braces/issues/84) also records that `3.0.3` remains the latest published version and that maintainers dispute the advisory's premise. TSM must not invent a fixed version or use an incompatible major downgrade of glTF Transform merely to silence audit output.

The exception is limited to this advisory and this exact developer-only lockfile chain:
- `@gltf-transform/cli@4.5.1`
- `micromatch@4.0.8`
- `braces@3.0.3`

The application runtime does not depend on these packages; the lockfile must mark each node as `dev: true`. The validation script `scripts/ci/validate-npm-audit.mjs` permits the gate to pass only when the npm audit report contains precisely the three transitive findings of this single advisory, the versions and install paths match this record, all nodes remain dev-only, and npm returned the expected audit exit status. Any new high/critical advisory, extra install path, production dependency, changed version, changed advisory chain or unexpected audit error fails closed. Tests live in `scripts/ci/validate-npm-audit.test.mjs`.

## Re-review trigger and remaining risk

Re-review this exception whenever the npm lockfile, `@gltf-transform/cli`, `micromatch`, or `braces` changes, or when upstream releases/updates the advisory. Remove the exception and return to the standard `npm audit --audit-level=high` gate as soon as a compatible patched release is available. Do not infer that the underlying advisory has been remediated from a passing CI status.

This is a scoped dependency-risk treatment, not a general audit bypass.
