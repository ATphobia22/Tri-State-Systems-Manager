# IBM Quantum Compute Service integration for TSM

## Official API surface (authoritative)

TSM uses only the **IBM Quantum Compute Service REST API** (cloud primitives), not On-Prem Quantum System REST.

| Resource | URL |
|---|---|
| API index | https://quantum.cloud.ibm.com/docs/en/api |
| Compute Service REST | https://quantum.cloud.ibm.com/docs/en/api/qiskit-runtime-rest |
| REST setup | https://quantum.cloud.ibm.com/docs/en/guides/cloud-setup-rest-api |
| IAM token API | https://cloud.ibm.com/apidocs/iam-identity-token-api |
| Resource Controller (instances) | https://cloud.ibm.com/apidocs/resource-controller/resource-controller |
| Private / Catalog Management API | https://cloud.ibm.com/docs/apis/resource-catalog/private-catalog |

**API version pinned in TSM contracts:** `2026-04-15` (`IBM-API-Version` header).

### Endpoints TSM may call

- US base: `https://quantum.cloud.ibm.com/api/v1/`
- EU-DE base: `https://eu-de.quantum.cloud.ibm.com/api/v1/`
- Auth: `POST https://iam.cloud.ibm.com/identity/token` with `grant_type=urn:ibm:params:oauth:grant-type:apikey`
- Headers on every Quantum call: `Authorization: Bearer <token>`, `Service-CRN: <instance CRN>`, `IBM-API-Version: 2026-04-15`
- Read-only smoke: `GET /backends`, `GET /usage`
- Jobs: `POST /jobs` with `program_id` = `sampler` only under TSM policy (estimator reserved/future)
- Sessions (optional): `POST /sessions` — not required for quarantine sampler path

### Instance provisioning (IBM Cloud, not Quantum QPU calls)

Create/manage Quantum Compute **instances** via IBM Cloud Resource Controller when automation is required. Optional Catalog Management / private catalog APIs govern *product visibility in IBM Cloud accounts*; they do **not** execute circuits and are out of the TSM worker hot path.

Instance parameters of interest: `instance_limit_seconds`, `usage_allocation_seconds`, `backends` (`["ANY"]` or explicit allow-list).

## Components

- Client: `integrations/quantum/ibm-quantum-client.ts`
- Worker: `integrations/quantum/ibm-quantum-worker.ts`
- Job contract: `contracts/quantum/ibm-quantum-job-v1.schema.json`
- Result receipt: `contracts/quantum/ibm-quantum-result-v1.schema.json`
- Engineering result (post-quarantine only): `contracts/engineering/solver-result-v1.schema.json`

## Safety model

The quantum request contract is `DERIVED` and `quarantine` only. It must not authorize operational control, modify source observations, or publish an engineering decision directly. A separate domain validation step is required before any result can be transformed into Solver Result v1.

Never feed regulated flood elevations, observed gauge values, FEMA/USGS source records, or approved engineering outputs into an autonomous quantum write path. Quantum may be used for bounded exploratory optimization (candidate ordering / small combinatorial screening) only when input/output hashes and a classical baseline are preserved.

## Configuration (server secrets only)

| Variable | Required | Notes |
|---|---|---|
| `IBM_QUANTUM_API_KEY` | yes | IBM Quantum Platform API key (dashboard). Never in Vite. |
| `IBM_QUANTUM_INSTANCE_CRN` | yes | Instance Cloud Resource Name |
| `IBM_QUANTUM_REGION` | no | `us` (default) or `eu-de` |
| `IBM_QUANTUM_API_VERSION` | no | default `2026-04-15` |
| `IBM_QUANTUM_TIMEOUT_MS` | no | default 20000; max 300000 |

IBM also documents `IQP_API_TOKEN` for some SDK paths; TSM standardizes on `IBM_QUANTUM_API_KEY` for the REST client.

## Operational requirements

1. Discover backends (`listBackends`) and confirm instance allocation before submission.
2. Enforce per-worker runtime, concurrency, and spend/usage budgets.
3. IBM rate guidance: ≤5 job submissions per minute per user — enforce ≤ that in-app.
4. Do not blindly retry POST. On uncertain network outcome, persist `unknown-submission` and reconcile via job list before retry.
5. Persist input + circuit SHA-256, API version, backend, job ID, remote status, shots, timestamps, result hash.
6. Treat all results as quarantined until schema, provenance, and classical comparison pass.
7. Never label simulator / synthetic / unavailable-hardware fallback as real IBM hardware.
8. Bearer tokens expire ≤1 hour — refresh via IAM; never log tokens or API keys.

## First smoke test

After secrets are configured server-side, call `listBackends()` only (read-only, non-billable job). Proceed to a human-approved one-qubit hardware sampler only after usage limits are confirmed.
