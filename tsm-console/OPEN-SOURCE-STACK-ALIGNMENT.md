# Open-Source Stack Alignment — Tri-State Systems Manager

Evaluated against listed technologies. **Only implement what serves public-interest Evidence / Visualization planes.**

| Technology | Decision | Rationale |
|------------|----------|-----------|
| **TypeScript** | **In use** | Default language for tsm-console |
| **Protocol Buffers** | **Adopt schema** | `proto/evidence_artifact.proto` + `@bufbuild/protobuf` for worker/API encoding |
| **Virtual Scroll** | **Adopt** | `@tanstack/react-virtual` on Evidence Ledger for large lists |
| **D3** | Defer | MapLibre + R3F cover maps/3D; add later for custom hydro charts if needed |
| **JSBI** | Skip | Native BigInt sufficient in modern browsers/Node |
| **W3C Keyname** | Defer | Follow when building full a11y keyboard matrix |
| **sass-true** | Skip | No Sass unit-test suite in Phase 1 |
| **Servo** | Skip | Research engine — not an app dependency |
| **Quill RPC** | Defer | Prefer existing token-proxy + future Connect if RPC expands |
| **HTML Imports polyfill** | Skip | Deprecated; ES modules already |
| **Angular Flex Layout** | Skip | React stack; use CSS flex/grid |

## Implemented this pass

1. `proto/evidence_artifact.proto` — canonical binary companion to JSON Schema  
2. `@bufbuild/protobuf` dependency for future codegen  
3. `@tanstack/react-virtual` + virtualized ledger list  
4. This alignment document


## Buf commands

```bash
npm run buf:lint
npm run buf:gen
npm run proto:all   # lint + generate
npm run buf:breaking
```

