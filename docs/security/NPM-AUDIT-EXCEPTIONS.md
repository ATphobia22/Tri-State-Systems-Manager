# npm audit exceptions

**Reviewed:** 2026-11-17 (braces baseline first reviewed 2026-10-18)  
**Owner:** TSM engineering / release-gate maintainer  
**Status:** two narrowly scoped, unpatched advisory exceptions. Neither represents a security patch, independent penetration test, or a clean zero-vulnerability audit.

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

## GHSA-fc5q-39xc-vjpf — picomatch repeated-extglob ReDoS (2026-11-17)

**Status: temporary, explicit developer-tooling risk acceptance, NOT patched; expires 2026-12-15 00:00 UTC.** [The advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) covers `picomatch` versions through 4.0.7. The npm registry still published 4.0.7 as latest on 2026-11-17; a speculative 4.0.8 cannot be installed. The issue is [tracked for remediation in #645](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/645).

A fresh `npm ci` + `npm audit --audit-level=high --json` reported **12 high, 0 critical, 4 moderate** findings. All 12 high findings were derived from this *one* picomatch advisory in paths marked `dev: true` in the exact lockfile:

```text
@gltf-transform/cli@4.5.1          @vitejs/plugin-react@6.2.1
anymatch@3.1.3                     chokidar@3.6.0
fdir@6.5.0                         micromatch@4.0.8
picomatch@4.0.7 (root)             picomatch@2.3.2 (three nested installs)
readdirp@3.6.0                     tinyglobby@0.2.17
vite@8.3.8                         vite-plugin-static-copy@4.1.1
vitest@5.1.0
```

`scripts/ci/validate-npm-audit.mjs` accepts that report **only** if all twelve finding names, all installation nodes, their exact versions, the sole high advisory URL, their `dev: true` classification, `high=12`, `critical=0`, and audit exit status `1` match the reviewed state. It additionally requires `vite@8.3.8` and patched `rolldown@1.2.17+` from the 1.2.x release line (the npm-resolved build currently has 1.2.19); this separately remediates [Vite GHSA-p4f5-76q4-ffq7](https://github.com/vitejs/vite/security/advisories/GHSA-p4f5-76q4-ffq7). Any extra high/critical advisory, newly exposed production dependency, different path/version, outdated Vite/Rolldown, or date after the fixed expiration causes a **hard failure**. The contract tests assert those negative cases and the live npm audit still runs on every required build.

**Threat limitations and controls:** this is a build/dev-tooling exception, not a public JavaScript runtime exception. Do not run Vite dev/preview servers on an Internet-exposed interface or pass untrusted user-controlled extglob patterns into these tools. CI must run in isolated, short-lived build environments with execution timeouts and no unnecessary production secrets. ReDoS remains possible if these assumptions are broken. GitHub Pages publishes compiled assets, not the Vite developer server. This document cannot certify future package changes or the safety of downstream uses.

The observed `npm audit` itself **continues to report 12 high advisories**; `waiverApplied: true` means an explicitly tracked, temporary risk was accepted by this repository's policy, not that 12 vulnerabilities were remediated. Do not describe this as a zero-vulnerability or externally audited release. Patch upstream or replace the affected dependency chain when a verified compatible fix exists; remove this exception rather than extending it silently.

## Re-review trigger and remaining risk

Re-review this exception whenever the npm lockfile, `@gltf-transform/cli`, `micromatch`, or `braces` changes, or when upstream releases/updates the advisory. Remove the exception and return to the standard `npm audit --audit-level=high` gate as soon as a compatible patched release is available. Do not infer that the underlying advisory has been remediated from a passing CI status.

This is a scoped dependency-risk treatment, not a general audit bypass.
