# Security audit applicability and remediation record

**Date:** 2026-10-17  
**Repository:** `ATphobia22/Tri-State-Systems-Manager`  
**Purpose:** Translate the supplied “Comprehensive Security and Architectural Audit” into repository-verifiable engineering work. This document is not a penetration-test report or a claim that all release gates pass.

## 1. Applicability findings

The supplied audit describes a C/C++ hardware-adjacent tri-state controller with physical address pointers, bus arbitration, register writes, signal attenuation, and Active/Inactive/High-Impedance hardware states. The repository's current README and architecture documentation describe a TypeScript/Python geospatial, hydrology, engineering-evidence, and scenario decision-support platform. The architecture explicitly states that TSM is not a bidirectional controller of physical systems.

Consequently, the audit's module names, complexity numbers, defect-density figures, memory-safety index, transition-race narrative, and CVSS scores are **not verified repository findings**. They must not be repeated as measured facts or used as acceptance criteria without source locations, reproducible analysis, and an applicable implementation. No evidence was found in the files inspected for a C/C++ Bus Arbitration Engine, physical register interface, or signal attenuation module.

## 2. Repository controls verified during remediation

- `.github/workflows/ci.yml` pins its inspected GitHub Actions by full commit SHA and declares read-only `contents` permissions at workflow/job scope.
- The inspected CI installs from a lockfile, runs dependency-integrity and `npx` policy checks, generates an SBOM/provenance artifact, runs `npm audit`, and checks npm signatures.
- `.github/workflows/codeql.yml` configures CodeQL for JavaScript/TypeScript and Python with SHA-pinned actions.
- `.github/dependabot.yml` configures scheduled npm, pip, and GitHub Actions updates.
- `SECURITY.md` already documents private vulnerability reporting and several fail-closed controls.
- The latest inspected commit's combined status response contained no status entries, and the workflow-run lookup returned no PR-triggered runs for that commit. These results do **not** establish that CI is green or that all Actions workflows completed.

## 3. Change in this remediation branch

Added `.github/workflows/secret-scan.yml` to run Gitleaks on pull requests to `main`, pushes to `main`, and manual dispatch. The workflow uses a full commit SHA for checkout and the Node 24-compatible Gitleaks v3 scanner, reads complete Git history, disables persisted checkout credentials and scanner PR comments, and grants only `contents: read`.

The scanner is intentionally not configured with a blanket allowlist. If it reports a candidate, a maintainer must determine whether it is a real credential, rotate exposed credentials where necessary, and add a narrow documented exception only for a confirmed false positive. Historical findings must not be dismissed merely because a credential appears in a test or old commit.

## 4. Required follow-up gates

1. Verify the Node 24-compatible secret-scanning workflow completes successfully on the latest PR commit; investigate and remediate any confirmed findings, rotating exposed credentials where necessary.
2. Run the full existing CI, CodeQL, dependency-integrity, SBOM, npm audit/signature, Python tests, and deployment artifact gates; record their actual statuses.
3. **Branch protection gap verified 2026-10-18:** the active `TSM main protection` ruleset currently enforces only branch deletion and non-fast-forward restrictions. It does not require pull requests, independent approvals, conversation resolution, or CI status checks; the repository-role bypass is configured as `always`. Update the ruleset in GitHub settings to require PRs, approvals where available, conversation resolution, and the intended CI checks, and restrict bypass to a documented emergency process. The available repository connection supports reading but not mutating rulesets, so this remote governance change remains outstanding.
4. Continue the existing fail-closed engineering release gates: approved AOI, qualified source inputs and datums, reproducible model artifacts, independent review, and separate runtime/deployment verification.
5. For any genuine state-machine/concurrency issue, identify the exact implementation file and prove the defect with a deterministic test before changing semantics. Do not introduce a hardware-oriented CAS state machine into TSM's unrelated geospatial architecture.

## 5. Acceptance criteria

- Secret scanning completes successfully, with all findings reviewed and no unrotated exposed credentials.
- All required CI and CodeQL checks pass on the final candidate commit.
- Dependency and action pins remain verifiable and reproducible.
- Main-branch protection is independently confirmed in GitHub settings.
- No production, hydraulic, safety, or regulatory claim is promoted without the evidence and human review required by TSM's existing release contracts.

## 6. Limitations

This change adds a scanner workflow but does not itself rotate credentials, alter GitHub's remote branch protection, prove that every historical secret is absent, or establish that the repository is vulnerability-free. The workflow result and actual GitHub settings remain required evidence.

## 7. Review of proposed C++ remediation snippets

The proposed snippets were reviewed as external suggestions, not accepted as repository patches. A repository code search for `std::atomic` and `PhysicalMemoryMapper` returned no matches; the inspected application stack is TypeScript/Python. Therefore no C++ source files were created.

The snippets also need corrections before they could safely be used in a genuine memory-mapped hardware project:

- **CAS plus mutex is redundant for the shown state update, but does not make the hardware write atomic.** The state is changed before `writeBusRegister` executes. If the hardware write fails, the software state can claim a transition that the device never accepted. A lock is not a reentrancy guard: calling the same lock-taking method recursively can deadlock with a non-recursive mutex. A correct design must define the source of truth, device-write failure semantics, synchronization of all writers/readers, and device-specific MMIO ordering.
- **The memory boundary check can overflow.** Expressions `targetAddress + sizeof(uint32_t)` and `baseAddress + size` can wrap around `uintptr_t`. Prefer subtraction-based checked range validation after proving `targetAddress >= baseAddress`, require `offset <= size` and `sizeof(uint32_t) <= size - offset`, validate alignment, and handle the hardware/platform's MMIO mapping and access rules. A numeric bounds check alone does not make an arbitrary address safe to dereference.
- **The transition table needs input validation.** Casting an arbitrary enum value to `size_t` and indexing the matrix can access out of bounds. Validate both indices or use an explicit mapping that rejects unknown enum values; add exhaustive transition tests.
- **The complexity claim is not established.** Replacing branches with a lookup table may improve auditability, but it does not prove a specific cyclomatic-complexity score or remove the need to test transition semantics.

These are code-review observations about the supplied examples, not confirmed defects in TSM. If future requirements introduce hardware control, isolate it in a separately scoped subsystem with platform-specific MMIO contracts, deterministic tests, and an explicit safety/security review.
