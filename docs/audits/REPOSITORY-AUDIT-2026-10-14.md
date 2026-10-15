# TSM repository audit — 2026-10-14

## Scope and evidence

Audit target: `ATphobia22/Tri-State-Systems-Manager`, default branch `main`, observed HEAD `a37818b4c96ce00f93abca48e9fe8453ee6f4e4c`. Review includes the current CI/deployment contract and draft PR #265 (evidence-first flood-twin vertical slice). This is a repository/API review, not a claim that a full clean-room build or production deployment was executed.

## Findings

### P1 — Public metadata snapshot size limit was applied after full buffering

The acquisition utility used `response.arrayBuffer()` and only checked the 5 MiB maximum after the response had been fully allocated. A large response could therefore consume memory well beyond the stated cap.

**Remediation:** stream and count bytes while reading; reject early from a declared Content-Length when available; cancel the reader on overflow.

### P1 — Redirects could bypass the source hostname allowlist

The source utility relied on Fetch's default redirect-following behavior. Checking only the initial URL does not guarantee the final host remains allowlisted.

**Remediation:** reject redirects (`redirect: "error"`), validate the response URL, and enforce HTTPS plus exact host allowlisting.

### P1 — Metadata snapshots were not required to be valid JSON

The old content-type gate accepted HTML and plain text even though all configured endpoints are JSON metadata endpoints. A successful HTTP response could be written as a misleading JSON-named artifact.

**Remediation:** require a JSON media type and parse the bounded response before writing artifacts.

### P2 — Contract verification is intentionally a subset, not full JSON Schema validation

The twin entity verifier validates high-value identity/provenance invariants but does not implement JSON Schema 2020-12. Existing tests largely prove the checked-in example passes and do not sufficiently exercise failure modes.

**Remediation in this change:** add executable negative tests for size boundaries, non-allowlisted hosts, redirect policy, content type and invalid JSON. A standards-compliant schema validator remains a separate follow-up if dependency policy permits it.

### P2 — Deployment contract requires backend verification separate from Pages

The deployment documentation correctly says GitHub Pages publishes the static Vite SPA and does not prove API, WebSocket, PostGIS or telemetry availability. Keep live checks opt-in until a concrete authorized backend deployment URL and expected API contract are configured.

## Validation status

- Source changes and dependency-free Node tests are part of the PR.
- Live public-source acquisition was not run as part of the audit; the tool is opt-in and creates files.
- No hydraulic model was executed, no pilot AOI was selected, and no calibration/validation evidence was fabricated.
- GitHub Actions must supply the final clean-runner result for the PR commit.
