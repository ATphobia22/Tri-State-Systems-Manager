# Quill Prism Negotiation · Hyper HTTP/3

## Transport negotiation (Prism)

Client advertises preferred profiles via HTTP `Prefer` header:

```http
Prefer: prism=hyper,turbo,classic
```

| Profile | Stack | Intended use | Status (Quill) |
|---------|--------|--------------|----------------|
| **Classic** | HTTP/1.1 + basic HTTP/2 | Legacy / enterprise proxies | Available |
| **Turbo** | HTTP/2 end-to-end | Cluster-internal | Available |
| **Hyper** | HTTP/3 over QUIC | Browser, mobile, lossy links | *Coming soon* in upstream Quill |

Server selects the best mutually supported profile. Failures use **RFC 7807 Problem Details** with real HTTP status codes (not 200 + error envelope).

## Hyper / HTTP/3 context

HTTP/3 cannot be negotiated *inside* an existing TCP+TLS session via ALPN alone (different transport: QUIC/UDP).

Typical bootstrap:

1. Client connects over TCP (H1/H2)
2. Server advertises H3 via `Alt-Svc` and/or HTTPS DNS RR (`alpn="h3,h2"`)
3. Client may race QUIC vs TCP or use H3 on subsequent connections
4. Inside QUIC, ALPN selects `h3`

Quill Hyper profile (when enabled) leans on:

- **quinn** / **h3** / **h3-quinn** / **rustls**
- Optional **WebTransport** (`quill-transport` feature `webtransport`) for browser bidirectional streams + datagrams
- Config knobs: 0-RTT, datagrams, connection migration, max streams, idle timeout

## TSM stance

| Concern | Decision |
|---------|----------|
| Browser console RPC | Stay on HTTPS JSON (`token-proxy`) → later **Connect-ES** over H1/H2 |
| HTTP/3 | Optional infra (CDN/edge) — not required for Phase 1 evidence correctness |
| Quill Hyper sidecar | Research only until Hyper is stable and a Rust worker is authorized |
| Negotiation header | Document only; do not implement Prism client in the React app yet |

Evidence integrity (SHA-256, Merkle, human gate) does not depend on H3.

