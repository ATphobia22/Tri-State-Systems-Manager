# IBM Quantum Compute Service integration for TSM

## API selection

Use IBM Quantum Compute Service REST API, not the separate Quantum System REST API restricted to eligible On-Prem / Direct Access deployments. Current documented API version: `2026-04-15`.

- API reference: https://quantum.cloud.ibm.com/docs/en/api/qiskit-runtime-rest
- REST setup: https://quantum.cloud.ibm.com/docs/en/guides/cloud-setup-rest-api
- Default base URL: `https://quantum.cloud.ibm.com/api/v1/`
- EU-DE base URL: `https://eu-de.quantum.cloud.ibm.com/api/v1/`
- Authentication: IBM IAM bearer token, `Service-CRN`, `IBM-API-Version` headers.

## Components

- Client: `integrations/quantum/ibm-quantum-client.ts`
- Request contract: `contracts/quantum/ibm-quantum-job-v1.schema.json`
- Result receipt: `contracts/quantum/ibm-quantum-result-v1.schema.json`
- Existing worker boundary: `integrations/runtime/worker-execution.contract.json`
- Existing engineering result contract: `contracts/engineering/solver-result-v1.schema.json`

## Safety model

The quantum request contract is `DERIVED` and `quarantine` only. It must not authorize operational control, modify source observations, or publish an engineering decision directly. A separate domain validation step is required before any result can be transformed into the existing Solver Result v1 contract.

Never feed regulated flood elevations, observed gauge values, FEMA/USGS source records, or approved engineering outputs into an autonomous quantum write path. Quantum optimization may be used for bounded exploratory optimization (for example, candidate ordering or small combinatorial screening) only when the input/output hashes and provenance are preserved and a classical baseline is recorded.

## Configuration

Provide `IBM_QUANTUM_API_KEY`, `IBM_QUANTUM_INSTANCE_CRN`, and optionally `IBM_QUANTUM_REGION`, `IBM_QUANTUM_API_VERSION`, and `IBM_QUANTUM_TIMEOUT_MS` through a server-side secret manager. Never expose these variables to Vite/browser bundles or check them into Git.

## Operational requirements

1. Discover backends and confirm the instance's allocation before job submission.
2. Enforce per-worker runtime, concurrency, and spend/usage budgets.
3. IBM documents a rate limit of five job submissions per minute per user; enforce a lower or equal application-side limit.
4. Do not blindly retry POST requests. If the network outcome is uncertain, persist an `unknown-submission` state and reconcile against IBM's job list before retrying.
5. Persist the immutable input and circuit artifact SHA-256 values, API version, backend, job ID, remote status, shot count, submission/retrieval timestamps, and result artifact hash.
6. Treat all results as quarantined until schema validation, provenance validation, and an independently computed classical comparison pass.
7. Never represent simulator, synthetic, or unavailable-hardware fallback output as a real IBM hardware result.

## First smoke test

After credentials and permissions are configured, invoke `listBackends()` from a server-side process. This is read-only and does not create a billable quantum job. Follow it with an explicitly approved one-qubit hardware test only after usage limits are confirmed.
