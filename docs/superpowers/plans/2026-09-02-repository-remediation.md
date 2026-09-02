# Tri-State Systems Manager Repository Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize TSM's repository, harden configuration and workflows, preserve geospatial/evidence governance boundaries, and replace the README with a government-engineering operating guide.

**Architecture:** Keep the existing four-plane architecture and fail-closed validation model. Improvements are additive or corrective: documentation and structure become explicit, workflow boundaries remain least-privilege, and evidence/geospatial contracts remain authoritative and human-gated.

**Tech Stack:** React 19, TypeScript, Vite, Node.js 22, npm lockfile, Python helpers, GitHub Actions, MapLibre, Three.js, USGS/NOAA/FEMA/Indiana geospatial data contracts.

**Spec:** `docs/superpowers/specs/2026-09-02-repository-remediation-design.md`

## Global Constraints

- Human authority is final; TSM does not issue LOMA, LOMR, CLOMR, No-Rise, FARA, or floodplain permits.
- Raw gage height is GAGE_DATUM until an explicit, product-matched conversion establishes NAVD88.
- Existing fail-closed CI gates must not be weakened.
- Node.js 22 remains the supported runtime floor.
- `maplibre-gl` remains pinned to 6.6.0 unless a verified dependency migration is separately justified.
- Proprietary IdP/AI/provider secrets must never be placed in browser code or committed to the repository.
- Experimental AI/agent and quantum paths remain outside regulatory write paths.
- Ambiguous files are not deleted without reference/supersession evidence.

---

### Task 1: Publish the government-engineering repository structure

**Files:**
- Create: `docs/REPOSITORY-STRUCTURE.md`
- Create: `docs/CHANGE-CONTROL.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: current top-level repository layout and existing governance documents.
- Produces: canonical repository map and documented cleanup/change-control rules.

- [ ] **Step 1: Document canonical directories and authority boundaries.**

  Define `tsm-console/` as the production console/runtime, `backend/` as server-side helpers, `data/` as source/provenance-controlled datasets, `docs/` as engineering/governance documentation, `scripts/` as validation/operations tooling, and `.github/workflows/` as CI/CD policy.

- [ ] **Step 2: Document cleanup rules.**

  State that generated artifacts, caches, credentials, and obsolete temporary material are removable when proven non-authoritative; ambiguous or potentially authoritative material requires reference/supersession analysis first.

- [ ] **Step 3: Update README links and navigation.**

  Replace the existing operator-oriented map with links to the canonical structure and change-control documents.

- [ ] **Step 4: Validate references.**

  Run the repository integrity and parse gates after the documentation changes.

- [ ] **Step 5: Commit the task.**

  Use commit message: `docs: establish government repository structure and change control`.

---

### Task 2: Replace README with government-engineering operating guide

**Files:**
- Modify: `README.md`
- Modify: `GOVERNMENT_QUICKSTART.md`

**Interfaces:**
- Consumes: ADR-005/ADR-006, existing data contracts, workflow gates, and operational commands.
- Produces: authoritative onboarding and operator documentation.

- [ ] **Step 1: Rewrite README sections.**

  Include mission, scope, intended users, authority model, four-plane architecture, trust boundaries, authoritative data sources, hydrologic/geospatial conventions, regulatory limitations, repository map, local setup, validation, deployment, configuration, security, AI governance, troubleshooting, evidence handling, change control, and professional-review requirements.

- [ ] **Step 2: Remove stale or ambiguous presentation language.**

  Replace promotional or cinematic wording with precise engineering terminology. Preserve the public-interest mission and stewardship charter without presenting simulations as engineering determinations.

- [ ] **Step 3: Rewrite quickstart for operators and engineers.**

  Distinguish local development from observation-only health checks, list Node/npm prerequisites, describe Keycloak PKCE configuration, and state that browser environments must not receive provider secrets.

- [ ] **Step 4: Validate commands against package scripts.**

  Ensure every documented command exists in `tsm-console/package.json` and that the documented validation sequence maps to existing CI gates.

- [ ] **Step 5: Commit the task.**

  Use commit message: `docs: replace README with government engineering guide`.

---

### Task 3: Harden CI/CD execution policy without weakening gates

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/deploy-pages.yml` only if inspection identifies a concrete correctness/security issue
- Modify: other workflow files only when a concrete duplicated or unsafe policy is verified

**Interfaces:**
- Consumes: existing npm scripts and validation gates.
- Produces: deterministic, least-privilege workflow execution with explicit timeouts and deployment dependencies.

- [ ] **Step 1: Inspect every workflow for permissions, unbounded execution, secret exposure, and duplicated build policy.**

  Do not remove a workflow solely because it appears redundant; establish its trigger and artifact/deployment dependency first.

- [ ] **Step 2: Add explicit job-level timeouts to production validation jobs.**

  Use a conservative timeout that is long enough for npm install/build/test on GitHub-hosted runners but prevents hung jobs from consuming the runner indefinitely.

- [ ] **Step 3: Preserve the exact commit-binding gate on pushes to `main`.**

  Keep the explicit `HEAD == GITHUB_SHA == FETCH_HEAD` verification.

- [ ] **Step 4: Preserve least-privilege workflow permissions.**

  Keep `contents: read` for validation jobs unless a deployment job demonstrably requires a different permission set.

- [ ] **Step 5: Validate workflow syntax and repository boundary checks.**

  Run `npm run check:workflow-boundaries`, `npm run check:shell-safety`, and the complete CI command sequence.

- [ ] **Step 6: Commit only verified workflow changes.**

  Use commit message: `ci: harden execution limits and workflow policy`.

---

### Task 4: Enforce configuration and dependency consistency

**Files:**
- Inspect/modify: `tsm-console/package.json`
- Inspect/modify: `tsm-console/package-lock.json`
- Inspect/modify: `tsm-console/vite.config.*`
- Inspect/modify: `tsm-console/tsconfig*.json`
- Inspect/modify: `.nvmrc` / `.node-version` only if present and inconsistent

**Interfaces:**
- Consumes: current package scripts and lockfile.
- Produces: one documented Node/npm runtime contract and consistent local/CI build behavior.

- [ ] **Step 1: Verify package/lock synchronization.**

  Confirm `npm ci` is the canonical install path and `maplibre-gl` is exactly 6.6.0 in both package metadata and the lockfile.

- [ ] **Step 2: Verify Node.js runtime declaration consistency.**

  Ensure package `engines.node >=22` agrees with CI and any repository version files.

- [ ] **Step 3: Review Vite chunking and source-map/asset settings.**

  Preserve explicit vendor splitting; record the large MapLibre/Three.js bundles as performance backlog rather than applying risky bundling changes without profiling.

- [ ] **Step 4: Run install, typecheck, build, and test gates.**

  Use `npm ci --no-audit --no-fund`, `npm run check:type`, `npm run build`, and `npm run test:all`.

- [ ] **Step 5: Commit only if a concrete configuration inconsistency is found.**

  Use commit message: `build: normalize runtime and dependency configuration`.

---

### Task 5: Audit and strengthen evidence/geospatial contracts

**Files:**
- Inspect: `tsm-console/src/lib/gage-datums.ts`
- Inspect: `tsm-console/src/lib/firm-panel-ssot.ts`
- Inspect: `tsm-console/src/lib/jurisdiction-rules.ts`
- Inspect: `tsm-console/server/ingestion/workers.mjs`
- Inspect: `tsm-site-constants-13101-bonebank.json`
- Inspect: `tsm-data-contract-schema-v1.0.0.json`
- Inspect: `tsm-evidence-artifact-schema-v1.0.0.json`
- Modify only if a verified contract gap exists

**Interfaces:**
- Consumes: existing schemas and hydrologic/geospatial constants.
- Produces: explicit provenance, datum, units, CRS, and evidence-state invariants.

- [ ] **Step 1: Verify raw observation semantics.**

  Confirm parameter 00065/NWS observed values remain GAGE_DATUM and cannot enter a NAVD88 field without explicit conversion metadata.

- [ ] **Step 2: Verify authoritative constants are not duplicated with conflicting values.**

  Compare site constants, gage datum definitions, jurisdiction rules, and UI displays.

- [ ] **Step 3: Verify ingestion is idempotent and provenance-preserving.**

  Confirm source identity, observation time, units, datum, validation state, and evidence linkage survive normalization.

- [ ] **Step 4: Add machine-checkable validation only where current behavior has a demonstrated gap.**

  Tests must reject missing/ambiguous vertical-datum metadata rather than silently guessing.

- [ ] **Step 5: Run geospatial and hydrologic validation tests.**

  Use `npm run check:geospatial`, `npm run check:site-consistency`, `npm run test:geodetic`, and the repository integrity gate.

- [ ] **Step 6: Commit verified contract fixes.**

  Use commit message: `fix: enforce evidence and geodetic provenance boundaries`.

---

### Task 6: Audit AI/agent and quantum isolation

**Files:**
- Inspect: `docs/ADR-006-Agentic-Autonomy-Ladder-and-Tool-Scope-Policy.md`
- Inspect: `scripts/ci/validate-quantum-boundary.mjs`
- Inspect: AI/agent integration files discovered by repository search
- Modify only when a verified boundary violation exists

**Interfaces:**
- Consumes: ADR-006 and current validation gates.
- Produces: explicit advisory-only AI semantics and hard experimental boundaries.

- [ ] **Step 1: Verify S1/S2/S3 policy against runtime code.**

  S1 remains no agency; S2 requires prescribed tools plus a human gate; S3 remains deferred.

- [ ] **Step 2: Verify no AI output can directly mutate regulatory authority state.**

  Any governance write path must remain human-gated.

- [ ] **Step 3: Verify quantum code cannot be imported into production regulatory paths.**

  Keep the existing quantum boundary validator authoritative.

- [ ] **Step 4: Add tests only for demonstrated boundary gaps.**

  Do not introduce a provider dependency or credentials merely to test isolation.

- [ ] **Step 5: Run AI/quantum boundary gates and full tests.**

  Use `npm run check:quantum-boundary` and `npm run test:all`.

- [ ] **Step 6: Commit verified governance fixes.**

  Use commit message: `governance: reinforce AI and quantum isolation boundaries`.

---

### Task 7: Perform evidence-based repository cleanup

**Files:**
- Inspect all tracked top-level files/directories.
- Modify/delete only files proven generated, temporary, duplicated, or superseded.
- Create: `docs/REPOSITORY-CLEANUP-LEDGER.md`

**Interfaces:**
- Consumes: repository search results, imports, workflow references, package scripts, docs links, and schema consumers.
- Produces: reduced structural ambiguity with a traceable cleanup ledger.

- [ ] **Step 1: Inventory tracked paths.**

  Categorize each path as production, authoritative data/contract, documentation, operations/CI, research/experimental, generated, temporary, or ambiguous.

- [ ] **Step 2: Search references before deletion.**

  Check imports, npm scripts, workflows, documentation, schemas, migrations, Docker configuration, and deployment manifests.

- [ ] **Step 3: Remove only proven non-authoritative artifacts.**

  Do not remove ambiguous or historical engineering records without a supersession rationale.

- [ ] **Step 4: Record each deletion or consolidation.**

  The cleanup ledger must list path, disposition, evidence, and replacement path when applicable.

- [ ] **Step 5: Run integrity and build gates.**

  Use `npm run check:integrity`, `npm run check:parse`, `npm run check:type`, `npm run build`, and `npm run test:all`.

- [ ] **Step 6: Commit cleanup.**

  Use commit message: `chore: clean repository structure with evidence ledger`.

---

### Task 8: Final verification and engineering release record

**Files:**
- Create: `docs/REMEDIATION-VERIFICATION-2026-09-02.md`
- Modify: `README.md` only for final verified status/details

**Interfaces:**
- Consumes: all remediation outputs and CI results.
- Produces: auditable final verification record.

- [ ] **Step 1: Run the complete local-equivalent CI sequence.**

  Execute `npm run ci:full` from `tsm-console` after dependency installation.

- [ ] **Step 2: Verify repository integrity after all changes.**

  Confirm no unexpected tracked artifacts, generated credentials, broken references, or schema drift.

- [ ] **Step 3: Verify production build output.**

  Confirm Vite production build completes successfully and no new critical bundle regression was introduced.

- [ ] **Step 4: Verify governance invariants.**

  Confirm human authority, datum handling, evidence provenance, AI/agent limits, and quantum isolation remain intact.

- [ ] **Step 5: Record actual verification results.**

  Include commit SHA, commands, pass/fail status, known non-blocking warnings, and unresolved backlog items. Do not claim a check passed unless it was actually run.

- [ ] **Step 6: Commit the verification record.**

  Use commit message: `docs: record repository remediation verification`.
