# Tri-State Systems Manager — Engineering Gate

**Status:** Active repository contract
**Scope:** repository-scale correctness, reproducibility, CI/CD, security, and integration quality

## 1. Canonical validation contract

Every production-bound change to `tsm-console` is expected to satisfy this order on a clean runner:

1. Node.js 22 runtime
2. npm 10.9.2 toolchain
3. public npm registry provenance check
4. lockfile reproducibility check with `npm install --package-lock-only`
5. clean locked install with `npm ci`
6. JavaScript/JSON parse gate
7. TypeScript strict typecheck
8. production Vite build
9. repository test suite
10. workflow-specific validation
11. deployment validation where deployment is configured

A failure at an earlier stage blocks interpretation of later stages.

## 2. Evidence policy

A repository inspection is not execution evidence. GitHub Actions configuration is not proof that a run passed. Deployment configuration is not proof of a deployed artifact.

Validation reports must distinguish:

- **PASS** — directly observed successful execution.
- **FAIL** — directly observed unsuccessful execution.
- **BLOCKED** — execution could not be performed because of an external prerequisite.
- **NOT CONFIGURED** — the repository does not contain the required integration.
- **UNVERIFIED** — insufficient execution evidence.

## 3. Dependency integrity

- `package-lock.json` is authoritative for `npm ci`.
- Lockfile URLs must resolve to the intended public registry rather than private mirror addresses.
- `package.json` and the lockfile must be reproducible with the pinned npm toolchain.
- Dependency changes must not be hidden by disabling lockfile verification.
- `postinstall` checks are not a substitute for a clean install gate.

## 4. TypeScript and runtime policy

- TypeScript runs with `strict: true`.
- The application runtime contract is Node.js >= 22.
- Parse validation and TypeScript validation remain separate gates.
- New code should preserve explicit types, defensive validation, deterministic behavior, and narrow interfaces.

## 5. CI/CD policy

- Workflows use least-privilege permissions.
- Dependency installation uses the public npm registry explicitly.
- CI should fail closed on malformed configuration, dependency provenance violations, type errors, build errors, and failed required tests.
- Workflow commands must reference scripts that actually exist in `package.json`.
- Generated or downloaded geospatial assets must have explicit provenance and validation rather than being treated as authoritative merely because they exist.

## 6. Digital-twin / evidence policy

TSM contains regulatory, geospatial, hydrologic, community, and visualization systems. Implementations must preserve provenance and distinguish authoritative evidence from illustrative, modeled, simulated, or cinematic outputs.

A visualization layer must not silently become the source of truth for a regulatory or engineering claim.

## 7. Security policy

- Never commit API keys, bearer tokens, private registry credentials, or other secrets.
- Public repository code must assume logs and artifacts can become public.
- Token-proxy behavior must keep credentials server-side and minimize exposure to browser code.
- Security fixes must be verified against the actual failure mode rather than merely documented.

## 8. Ecosystem reuse policy

Reusable assets from sibling repositories may be adopted only after checking:

- license and ownership compatibility;
- runtime and dependency compatibility;
- security posture;
- test coverage and maintenance state;
- data provenance;
- API/interface compatibility;
- operational fit with TSM's architecture.

Copying code solely because it appears similar is prohibited. Prefer small, explicit integration boundaries and shared contracts.

## 9. Completion standard

The repository is not declared production-ready until the final rescan confirms that fixes did not leave stale workflow assumptions, duplicate implementations, dead configuration, dependency drift, exposed secrets, or unverified claims of deployment success.
