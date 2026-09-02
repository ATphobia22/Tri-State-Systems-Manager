# ADR-006: Agentic Autonomy Ladder and Tool-Scope Policy

**Status:** Accepted  
**Date:** 2026-09-02  
**Related:** ADR-004 (Human Authority Final), ADR-005 (Four-Plane Architecture), NIST AI RMF 1.0, NIST AI 600-1 (Generative AI Profile), NIST AI RMF Critical Infrastructure concept note (2026-04)

## Context

Tri-State Systems Manager informs people; it does not silently govern people. Any agentic or generative capability must preserve human authority, evidence provenance, and Indiana/federal compliance posture.

## Decision

TSM adopts a progressive autonomy ladder. **S1 is the current production default.** S2 may be introduced only behind explicit human gates. S3 is out of scope until Critical Infrastructure profile controls and agent identity are production-ready.

### Autonomy ladder

| Scope | Name | Agent may | Human must |
|-------|------|-----------|------------|
| **S1** | No agency | None (tools are deterministic services only) | Initiate and approve every consequential action |
| **S2** | Prescribed agency | Propose drafts, summaries, candidate EvidenceArtifacts using an allow-listed tool set | Approve every Evidence Ledger append and every jurisdiction-affecting output |
| **S3** | Supervised agency (future) | Execute inside pre-approved policy bounds; escalate exceptions | Retain kill-switch, continuous monitoring, and final authority |

### Tool-scope policy (S2)

Allow-listed tools only:

- Read-only hydrologic fetch (USGS / NWPS)
- Freeboard / residual analytics (LAG − BFE)
- H3 k-ring spatial summaries
- Draft text generation via **local** Ollama / llama.cpp only

Forbidden without a new ADR:

- Direct Merkle / Evidence Ledger write without a human role
- Auto-filing to FEMA, LOMA/LOMR, grants, or any regulatory system
- External model API credentials
- Long-lived static API keys for agents

### Identity and audit

- Agents receive short-lived, audience-restricted tokens (Keycloak public-client patterns or future SPIFFE workload identity).
- Every agent action that produces durable output must emit an `EvidenceArtifact` with `operator_or_service_identity`, full `transformation_chain`, and correct `authority_class` / `derivation_class` / `is_simulation_demo`.
- `governance_status` remains `human_review_required` until a human approves.

### NIST AI RMF mapping

| Function | Control |
|----------|---------|
| Govern | ADR-004 + this ladder; human authority non-negotiable |
| Map | Explicit tool allow-list, SIMULATION_DEMO labeling, plane separation |
| Measure | Merkle provenance, fail-closed SHA-256 store, scientific uncertainty fields |
| Manage | Human gates, no auto-filing, local-first AI, kill-switch requirement for any future S3 |

## Consequences

- Positive: Clear path to useful assistance without surrendering governance.
- Positive: Aligns with Critical Infrastructure AI risk expectations.
- Negative: S2 features require additional UI for human approval queues.
- Neutral: S1 remains fully operational without any agent runtime.

## Implementation notes

1. Do not enable S2 write paths until an approval UI and role check exist.
2. Local AI only (Ollama / llama.cpp). No OpenAI/Groq/Gemini/OpenRouter secrets in repository or runtime defaults.
3. Update `GOVERNMENT_QUICKSTART.md` when S2 is first enabled in a non-demo environment.
