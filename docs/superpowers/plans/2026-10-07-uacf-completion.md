# UACF Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the existing UACF kernel and complete the missing runtime/application/provider boundaries without duplicating the existing TSM runtime.

**Architecture:** The canonical contracts remain in `packages/contracts/src/index.ts`. Legacy sibling contract modules become compatibility re-exports. A new `packages/agent-runtime` composes the existing Fabric/Router/Policy/Registry path. Provider directories expose real adapters around existing local/MCP/OpenAPI capabilities rather than placeholder remote integrations. Dashboard/playground/docs are lightweight operational surfaces built on the gateway API.

**Tech Stack:** TypeScript 5.9, NodeNext, Node HTTP, existing UACF contracts/router/registry/policy/provider-runtime, Node test runner via tsx.

**Spec:** Approved UACF completion design from the 2026-10-07 architecture review.

## Global Constraints

- `packages/contracts/src/index.ts` is the canonical public contract surface.
- No secrets, provider API keys, or credentials are committed.
- Local/deterministic execution remains available without external provider credentials.
- Existing TSM geospatial/runtime behavior is preserved.
- New production code is introduced test-first and verified by the existing UACF gates.
- No empty placeholder packages are added.

## Review Focus

- Legacy contract imports must remain source-compatible while resolving to canonical types.
- Agent execution must preserve request context, policy, provenance, and trace identity.
- Provider adapters must fail closed when required configuration is absent.
- Browser/search capability boundaries must not silently fabricate external results.
- UACF applications must degrade cleanly when the gateway is unavailable.

### Task 1: Canonicalize contracts
- [ ] Write compatibility/type tests for sibling contract modules.
- [ ] Verify the tests fail against the divergent definitions.
- [ ] Replace sibling definitions with canonical re-exports.
- [ ] Run the focused contract test and UACF typecheck.

### Task 2: Add agent runtime
- [ ] Write failing tests for successful execution, denied execution, and deterministic context propagation.
- [ ] Implement `AgentRuntime` over `UniversalCapabilityFabric`.
- [ ] Run focused and full UACF tests.

### Task 3: Add real provider boundaries
- [ ] Write provider contract tests.
- [ ] Implement local provider delegation plus explicit search/browser provider boundaries over existing capability providers.
- [ ] Register them without changing existing gateway defaults.
- [ ] Verify no credentials are required.

### Task 4: Add operational UACF apps
- [ ] Add gateway-backed dashboard.
- [ ] Add playground for capability execution.
- [ ] Add generated/reference docs surface.
- [ ] Add smoke tests and workspace metadata.

### Task 5: Integrate and verify
- [ ] Update UACF TypeScript inclusion/workspace metadata.
- [ ] Run UACF tests, full repository tests, typecheck, and production build where locally possible.
- [ ] Inspect resulting diff for unintended TSM changes.
- [ ] Commit coherent changes and rescan GitHub Actions/Pages.
