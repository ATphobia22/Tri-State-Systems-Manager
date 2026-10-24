# Apple open-source reuse assessment for TSM

**Reviewed:** 2026-10-24  
**Scope:** `https://opensource.apple.com/`, Apple OSS distributions, and Apple-maintained projects that might inform TSM architecture. This is an applicability assessment, not a claim that Apple platform source code is directly portable into TSM.

## Sources and decisions

| Project/source | Useful idea | TSM decision |
|---|---|---|
| [Apple Open Source](https://opensource.apple.com/) and [Apple OSS Distributions](https://github.com/apple-oss-distributions) | Use canonical upstream repositories and release sources; check each project's license and platform scope before reuse. | Keep source/license attribution and provenance for any future reused code; do not scrape or vendor source without a specific requirement. |
| [Pkl](https://github.com/apple/pkl) — Apache-2.0 configuration-as-code language with validation/tooling | Treat operational configuration as validated, reviewable data rather than unvalidated environment strings. | Apply this idea immediately through JSON Schema and Node contract checks already used by TSM. Do not add a Pkl runtime dependency until configuration complexity justifies another toolchain. |
| [FoundationDB](https://github.com/apple/foundationdb) — Apache-2.0 distributed transactional key-value store | Strong transactions and explicit consistency boundaries can be useful for a future durable evidence ledger. | Do not introduce a new database without a persistence/consistency requirement, operational design, backup/restore test, and migration plan. Existing Merkle evidence and storage abstractions remain unchanged. |
| [SwiftNIO](https://github.com/apple/swift-nio) — Apache-2.0 asynchronous networking framework | Test networking components independently of real sockets and exercise failure paths deterministically. | Adopt the testing principle for the TypeScript/Python stack: contract tests for API shapes and failure states. SwiftNIO itself is Swift-only and is not added as a Node dependency. |
| [Swift Collections](https://github.com/apple/swift-collections) — Apache-2.0 data structures for Swift | Stable public API boundaries, explicit experimental status, and compatibility discipline. | Keep TSM integration contracts versioned and machine-checked; do not import Swift collections into the TypeScript runtime. |

## Implemented changes

1. Fixed the missing `unavailableStage()` export used by the React Router loader. It returns an explicit unavailable state with null measurements, preserves the gage-datum label, and makes no network request.
2. Replaced npm-incompatible `workspace:*` dependency specifications with explicit semver ranges matching the local workspace package versions. npm workspaces can then link local packages using the normal version contract.
3. Added a contract test that checks local workspace dependency declarations before CI can regress to the unsupported protocol.
4. Kept the existing evidence and safety boundary: unavailable data is not fabricated, and a platform/open-source idea does not become an engineering authority by itself.

## Validation boundary

The repository's CI is the execution authority for the complete monorepo. A successful focused test does not establish that all builds, platform workflows, deployment steps, or end-to-end tests pass. The full release is green only after all required workflows complete successfully.
