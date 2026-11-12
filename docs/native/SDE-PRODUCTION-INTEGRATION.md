# SDE native production integration / acceptance record

**Implementation state:** Rust CDC store, graph serializer, provenance-restoring evidence adapter, Python SQLite bridge, bounded parallel reasoner contract, Windows Shipping staging/signing integration, cross-platform unit/integration tests, and representative **metadata-proxy** benchmark CI have source implementations. This document does not assert UE Shipping packaging or neural-model inference has been witnessed.

## Offline data and authority flow

1. Source application supplies `tsm.reasoning-graph.v1` JSON with nodes, edges and deterministic identifiers.
2. `sde-graph ingest <store> <graph.json> <provenance.json> <record.json>` validates and sorts the graph, chunks it with rolling polynomial CDC and SHA-256 object IDs, stores the actual provenance bytes and creates `tsm.sde.evidence-record.v2` in `<store>/ledger`.
3. `sde-graph verify <store> <record.json>` confirms ledger-file equality and reconstructs/verifies graph and provenance bytes from chunks. It does **not** certify scientific claims.
4. `backend.sde_evidence_adapter.SDEEvidenceAdapter.ingest(..., run_id=...)` executes the two CLI steps and appends a separate `SDEReasoningGraph` record to existing `SQLiteEvidenceLedger` with `NOT_EVALUATED`, `NEURAL_INFERENCE_NOT_EVIDENCED` and the hashes of source/manifest files. The existing ledger retains its own chain.
5. `parallel::evaluate_parallel` accepts a caller-implemented `Reasoner` for independent candidate evaluation, bounds worker counts and candidate counts, and deterministically orders the outcomes. **No ONNX/LLM model, weights or UI is installed by this implementation.**

Inferred scores and explanations must not turn an evidence record into `VERIFIED`; final authority remains human and existing engineering/rules validation gates.

## Runtime directory design

- Program Files: `<app>/Tools/sde-graph.exe` (signed and included recursively by Inno Setup when the genuine Win64 Shipping pipeline executes).
- User-writable, locally backed working storage: project-selected `SDE_STORE_ROOT` outside Program Files. Operators must enforce ACLs and backup/retention policies on ledger and objects.
- No ports, WebSockets, WebViews, PostgreSQL services or internet access required for the SDE tool.
- Do not introduce sensitive or protected data until encryption, permissions, retention and threat-model reviews are completed. Content hashes can reveal equality of input chunks.

## Packaging and verification

`scripts/native/Build-TSMNativeWindows.ps1` now calls `Stage-SovereignDedupEngine.ps1` after UE `BuildCookRun` and before Inno Setup. It compiles a Windows x64 Rust `sde-graph.exe` using toolchain `1.85.1`, hashes the staged binary, then individually signs and Authenticode-verifies the companion using the configured signing certificate and HTTPS timestamp service. A missing Rust toolchain, missing Shipping archive, staging mismatch, invalid signature or absent code-signing credentials blocks the release. The installer inherits the recursively staged signed tool.

The real Windows self-hosted UE5 runner still must prove its toolchain, packaging, signed artifacts, clean air-gapped startup and headed rendering. A passing `TSM Windows x64 Offline Runtime` static CI contract is **not** that runtime proof.

## CI and measured savings

`.github/workflows/sovereign-dedup-engine.yml` runs Rust tests, a real `sde-graph` -> Python adapter -> SQLite evidence ingest/verify/tamper test on Ubuntu and Windows, and a benchmark of three actual committed TSM acquisition/runtime manifests. Benchmark outputs are uploaded as separate `sde-metadata-corpus-<os>` CI artifacts.

The three metadata files are a **proxy corpus**, not production reasoning subgraphs. Their savings cannot establish a claimed 40–70% reduction for reasoning workloads. Actual retained-byte savings must count object files plus all ledger/manifests, directory metadata, backup copies and any encryption overhead, and benchmark production-sized canonical subgraphs.

## Remaining independent release gates

- The generated `Cargo.lock` is now source-controlled and builds use `--locked`; complete dependency-license/vulnerability review and create release SBOM/signature evidence for Rust and Unreal artifacts.
- Verify power-loss durability (directory fsync/NTFS recovery), multi-process writer stress, orphan temp cleanup, documented garbage collection/retention and backup restoration.
- Integrate and evaluate a licensed, pinned offline neural model with bounded CPU/GPU resources, reproducible inference inputs and provenance; current parallel trait and test stub are not a trained model.
- Connect the evidence/parallel tools to production UE menus or sanctioned IPC, with human-review UX and signed output reports. The staged CLI is not a native UI integration.
- Run UE5.8 Shipping packaging on an authorized Windows runner and verify clean network-disabled Windows 11 installation, real project data checksums, terrain/tiles, signed binaries, FPS/VRAM and workflow artifacts.
- Audit all SHA-256, unit, CRS and vertical-datum sources independently; byte integrity does not imply scientific validity.

Until these gates pass, status must be **in development / not release certified**, even if SDE CI is green.
