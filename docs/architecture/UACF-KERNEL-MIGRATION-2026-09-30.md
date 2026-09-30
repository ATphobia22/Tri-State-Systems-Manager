# UACF Kernel Migration — 2026-09-30

TSM now has a canonical UACF/UACP kernel boundary layered over the existing application, backend, data, and Unreal systems.

## Build order

1. Contracts
2. Schemas
3. Registry
4. Router
5. Policy
6. Provenance
7. Events
8. Provider runtime
9. Model runtime
10. MCP/OpenAPI/research/workflow boundaries
11. TSM capability adapters
12. Unreal integration

## First executable contract

`test.echo` → `geo.spatialQuery` → `tsm.hecras.run`

The HEC-RAS test verifies capability routing only. It does not claim that a real HEC-RAS solver has been executed.

## Runtime constraints

Oracle Cloud remains the deployment target. The login-free TSM runtime and removal of live river-gauge dependencies remain preserved. No external provider credential is fabricated by the kernel migration.

UACP is the semantic contract; MCP, OpenAPI, HTTP, JSON-RPC, SSE, WebSocket, and CLI remain integration/transport mechanisms.