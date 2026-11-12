# Sovereign Deduplication Engine (SDE)

Rust-only offline content-defined chunking for **canonical serialized reasoning subgraphs** and other immutable evidence blobs. SDE does not parse graph semantics: graph nodes and edges must be canonicalized upstream with a versioned serialization contract. Do not assume semantically identical graphs have identical bytes.

## Design

- Rabin GF(2) rolling polynomial fingerprint (degree-53 polynomial `0x3DA3358B4DC173`), 64-byte rolling window, for **boundary selection**.
- Default minimum / target / maximum chunk lengths: 4 / 16 / 64 KiB.
- SHA-256 cryptographic identities for each chunk and for the full input.
- Content-addressed objects stored in `objects/<first-two-hex>/<sha256>`.
- Existing objects are byte-verified before reuse; restore verifies every chunk and the reconstructed full-input SHA-256.
- No external network, account, database or daemon required.

## Build and use

```bash
cargo test --manifest-path crates/sovereign-dedup-engine/Cargo.toml
cargo build --release --manifest-path crates/sovereign-dedup-engine/Cargo.toml
cargo run --manifest-path crates/sovereign-dedup-engine/Cargo.toml -- store ./sde-cache ./subgraph.canonical.json ./subgraph.manifest.json
cargo run --manifest-path crates/sovereign-dedup-engine/Cargo.toml -- restore ./sde-cache ./subgraph.manifest.json ./subgraph-restored.json
```

Use a deterministic canonicalization scheme such as RFC 8785 JSON Canonicalization Scheme for JSON graphs, with explicit ordering for unordered graph collections. Track graph schema, canonicalizer version and evidence provenance outside the chunk manifest. Encrypt sensitive records at rest according to project policy; hashes alone do not provide confidentiality. The store publishes individual objects atomically, but is not transactional across multiple files, and the CLI reads the complete input into memory: **do not use it for multi-GB DEM/LAZ files without adding bounded streaming and crash recovery**.

## Compression and performance

SDE is **deduplication, not compression**. The 40–70% reduction is an unverified hypothesis and depends on repeated chunk content. Measure using a representative corpus:

`saved_fraction = 1 - unique_chunk_bytes / logical_source_bytes`

This excludes manifest, filesystem and encryption overhead, so actual on-disk savings can be lower. The CLI's single-manifest metric cannot show cross-file savings; use the Rust `metrics(&[Manifest])` API over a corpus. Do not claim 40–70% until independently benchmarked.

## Release gates

- Unit tests on CI and Windows x64 Rust build
- Deterministic canonicalization of reasoning subgraphs and migration/version contract
- Corpus-level benchmarks, including adversarial inputs and actual on-disk overhead
- Crash recovery, safe garbage collection and concurrent writers
- Privacy threat model and encryption before production evidence ingestion
- Integration adapter and end-to-end provenance validation

The current crate is a bounded initial implementation, not yet wired to TSM's evidence ledger or UE runtime.


## Integrated reasoning and ledger modules (v1)

- `graph::canonical_graph`: validates node identities and edge references, sorts unordered graph collections and emits versioned deterministic JSON bytes. This is **not** a complete RFC 8785 JCS implementation; cross-language producers must follow the same serialization contract. Schema `tsm.reasoning-graph.v1`.
- `evidence::ingest_graph`: hashes canonical graphs, deduplicates chunks and atomically publishes a content-addressed, append-only JSON ledger record, marked `UNVERIFIED`. Caller supplies nonempty provenance bytes; cryptographic linkage does not establish scientific correctness or regulatory authority.
- `parallel::evaluate_parallel`: bounded worker orchestration for independent reasoning candidates, deterministic result ordering and pluggable `Reasoner` inference adapters. **No neural model or GPU inference runtime is bundled**; the included reasoner is only a test stub.
- Object and ledger files are written to unique temporary files and published by atomic hard-link; a failed publish leaves only an orphan temp file, never a partially published target. Recovery should delete stale `.tmp-*` files only after confirming no active writers. Safe garbage collection and multi-process leases are not implemented.

## Representative-corpus benchmark

```bash
cargo run --release --manifest-path crates/sovereign-dedup-engine/Cargo.toml --bin sde-benchmark -- ./sde-cache ./sde-report.json ./evidence-graph-1.json ./evidence-graph-2.json
```

Provide actual project evidence graphs to measure deduplication. The benchmark reports elapsed time, logical bytes, unique chunk bytes and physical object-file bytes. Do not reuse a cache containing unrelated objects when interpreting corpus-only storage totals. Benchmark outputs are not automatically a release certification.

## Outstanding production dependencies

A fully deployed neural system still requires a selected/licensed local model, inference runtime, calibration and evaluation data, GPU/CPU resource limits, security review, model/version provenance, a human-review UI and integration with the existing TSM evidence API. A repository-local append-only JSON ledger is a **proposed adapter**, not proof that existing application evidence endpoints are wired. Crash-recovery integration tests, process-level concurrency stress tests, Windows CI and authentic corpus metrics remain release gates.
