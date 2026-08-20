# Quill RPC · Buf / protobuf-es — TSM alignment

## Quill RPC architecture (research)

Source: https://github.com/jeffhajewski/quill (Rust, protobuf-first)

| Piece | Role |
|-------|------|
| **quill-core** | Framing, RFC 7807 Problem Details, flow control |
| **quill-proto** | Protobuf + Quill annotations |
| **quill-transport** | Prism profiles: Classic (H1/H2), Turbo (H2), Hyper (H3/QUIC) |
| **quill-server** | Routing, middleware, streaming |
| **Prism negotiation** | `Prefer: prism=hyper,turbo,classic` |
| **Errors** | Real HTTP status + RFC 7807 — not 200 + error envelope |
| **WebTransport** | Optional H3 streams/datagrams for browsers |

**TSM decision:** Quill is **Rust-native**. Console is TypeScript. Do **not** adopt Quill as the primary browser RPC stack. Prefer:

1. Existing `token-proxy.mjs` HTTP JSON APIs (Phase 1)
2. **Connect-ES + protobuf-es** when typed RPC is needed (same `.proto`, JS/TS native)
3. Optional later: Quill **sidecar** for high-throughput ingestion workers in Rust

## Buf / protobuf-es tooling

| Package | Role |
|---------|------|
| `@bufbuild/protobuf` | Runtime: `create`, `toBinary`, `fromBinary`, `toJson` |
| `@bufbuild/protoc-gen-es` | Generates plain TS types + schema objects |
| `@bufbuild/buf` | CLI: `buf lint`, `buf generate`, `buf breaking` |
| Optional `@connectrpc/connect` | HTTP/gRPC-Web RPC on the same schemas |

### Generate (after `npm i -D @bufbuild/buf @bufbuild/protoc-gen-es`)

```bash
cd tsm-console
npx buf lint
npx buf generate   # → src/gen from proto/
```

Config: `buf.yaml`, `buf.gen.yaml`. Schema: `proto/evidence_artifact.proto`.

protobuf-es v2 uses **schema objects + plain message types** (not class getters) — friendly to React and immutable state.

## Recommended TSM path

```
.proto ──buf generate──► src/gen/*_pb.ts
                │
    ┌───────────┴───────────┐
    │ JSON (token-proxy)    │ Binary (workers)
    │ Connect-ES (future)   │ Optional Quill Rust sidecar
    └───────────────────────┘
```

Human authority and fail-closed evidence rules unchanged.

