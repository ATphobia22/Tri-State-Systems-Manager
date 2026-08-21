# Scan: ATphobia22 Turbot / Turbo* repositories

Scanned 2026-08-20. All listed repos respond HTTP 200 and appear as **forks**.

## Inventory

| Fork | Upstream / nature | TSM relevance |
|------|-------------------|---------------|
| **powerpipe-docs** | Turbot Powerpipe docs (markdown) | **High (ops pattern)** — dashboards/benchmarks-as-code |
| **steampipe-docs** | Turbot Steampipe docs | **High (ops pattern)** — SQL over APIs via plugins |
| **terraform-provider-pipes** | Turbot Pipes TF provider | Medium — IaC for hosted workspaces only if TSM uses Pipes cloud |
| **go-kit** | turbot/go-kit (Go helpers) | Low for TS console; optional if Go workers added |
| **turbot-client** | OpenCorporates-era Turbot bot CLI (Ruby gem lineage) | **Low** — different “Turbot” product; not Steampipe stack |
| **TurboticAutomationAIOpen** | Turbotic Automation AI (RPA-style) | Out of scope for public Evidence plane |
| **TurboTransformers** | CPU/GPU transformer inference runtime | Optional ML inference plane later; not Phase 1 |
| **TurboTools** | Turbo compressor design tools | Unrelated mechanical domain |
| **TurboTrain** | ICCV 2025 multi-agent perception (UCLA Mobility) | Unrelated AV research |

## What helps TSM (adopt patterns, not vendor lock-in)

### Steampipe + Powerpipe (recommended optional ops lane)

Turbot open source (v1.0 suite with Flowpipe):

| Tool | Role | TSM mapping |
|------|------|-------------|
| **Steampipe** | Postgres FDW-style **plugins** → query cloud/SaaS as SQL | Inventory AWS/GitHub/K8s used by TSM infra; **not** a substitute for USGS/FEMA evidence workers |
| **Powerpipe** | **Benchmarks & dashboards as HCL**; DB-agnostic (Postgres/SQLite/DuckDB/MySQL) | Compliance posture UI; CIS/NIST-style controls against *our* infra |
| **Flowpipe** | Workflow automation | Optional job orchestration for ingest schedules |

**Concrete TSM uses (optional Phase 1.5+):**

1. **GitHub compliance mod** — branch protection, CODEOWNERS, MFA on org — aligns with open-source governance ADR-003.
2. **AWS compliance mod** — if TSM hosts on AWS: CIS, NIST 800-53 controls as *infra* checks, separate from flood Evidence Ledger.
3. **Custom Powerpipe mod** — SQL over evidence-store export (DuckDB/Postgres) for “artifacts missing transformation_chain” dashboards.
4. **Never** pipe Steampipe cloud plugin rows into EvidenceArtifact as OBSERVATION without Authority Registry + SHA-256 + human gate.

### Explicit non-integration

- Do **not** vendor TurboTransformers / TurboTrain into the flood twin as authority.
- Do **not** treat turbot-client (OpenCorporates bots) as IdP or policy engine.
- Do **not** collapse Powerpipe benchmark pass/fail into regulatory FARA/No-Rise determinations.

## Suggested optional layout (not required for Phase 1)

```
tsm-ops/
  powerpipe/
    mod.pp          # tsm_evidence_hygiene benchmark stubs
  README.md         # install steampipe + powerpipe; human authority note
```

Install (ops machine only):

```bash
# https://powerpipe.io/docs
powerpipe mod install github.com/turbot/steampipe-mod-github-compliance
# steampipe plugin install github
```

## Decision

| Item | Decision |
|------|----------|
| Copy fork source into tsm-console | **No** — use upstream Turbot packages when needed |
| Document pattern | **Yes** (this file) |
| Wire Steampipe into evidence ingestion | **No** |
| Optional GitHub/AWS compliance dashboards | **Yes, ops-only**, labeled non-regulatory |

Human authority remains final. Technology informs; it does not silently govern.

