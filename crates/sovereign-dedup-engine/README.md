# Sovereign Deduplication Engine (SDE)

Rust-only offline content-defined chunking for **canonical serialized reasoning subgraphs** and other immutable evidence blobs. SDE does not parse graph semantics: graph nodes and edges must be canonicalized upstream with a versioned serialization contract. Do not assume semantically identical graphs have identical bytes.

## Design

- Rabin-Karp rolling polynomial fingerprint, 64-byte rolling window, modulo 2^64, for **boundary selection**.
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

Use a deterministic canonicalization scheme such as RFC 8785 JSON Canonicalization Scheme for JSON graphs, with explicit ordering for unordered graph collections. Track graph schema, canonicalizer version and evidence provenance outside the chunk manifest. Encrypt sensitive records at rest according to project policy; hashes alone do not provide confidentiality. The current store is not transactional across multiple files, and the CLI reads the complete input into memory: **do not use it for multi-GB DEM/LAZ files without adding bounded streaming and crash recovery**.

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
