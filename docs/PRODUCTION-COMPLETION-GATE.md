# TSM Production Completion Gate

**Authoritative branch:** `main`  
**Purpose:** release-readiness gate for the complete Tri-State Systems Manager stack.

## Required verification planes

- [ ] Canonical repository CI passes on the exact `main` commit.
- [ ] UACF / engineering-evidence / twin-fabric contracts pass.
- [ ] TypeScript, Python, schema, parse, provenance, spatial-topology and security gates pass.
- [ ] Exact eight-county spatial acquisition and SHA-256 verification pass.
- [ ] Linux offline runtime builds and its manifest/checksums verify.
- [ ] Windows x64 offline runtime builds natively on `windows-2022`; manifest, installer artifacts, offline dependency plane, API health and HEC-RAS contracts verify.
- [ ] GitHub Pages production build passes and the deployed page URL returns a valid application shell.
- [ ] Pages deep-link fallback (`404.html`) and required asset paths verify.
- [ ] API readiness is verified when an authorized HTTPS API deployment is configured; otherwise the local-first/no-login offline mode remains the declared production mode.
- [ ] No unapproved external hosting or deployment surface remains authoritative.
- [ ] No open pull requests remain.
- [ ] Stale/superseded branches are not treated as deployment surfaces.
- [ ] Release artifacts carry deterministic provenance and SHA-256 evidence.

## Completion rule

A release is **not** declared fully green from source inspection alone. The exact `main` commit must have successful applicable GitHub Actions runs and successful runtime/deployment verification. Historical green runs are evidence only for the commit that actually ran.

## Runtime boundary

HEC-RAS remains an external authorized solver boundary. TSM does not fabricate hydraulic results when the solver or required engineering evidence is unavailable.

## Public deployment boundary

GitHub Pages hosts the static console. The browser plane remains independently deployable from the API. Live external observations, authentication and licensed/private upstream services are not required for the local-first offline console.

## Final release evidence

Record:

1. exact release commit SHA;
2. successful workflow run IDs;
3. Windows x64 artifact name and SHA-256;
4. Linux offline artifact name and SHA-256;
5. exact spatial artifact and SHA-256;
6. deployed Pages URL and HTTP verification result;
7. API readiness result or explicit offline-mode status;
8. unresolved warnings, if any.

**No green claim without evidence.**
