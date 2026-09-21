# Security Policy — Tri-State Systems Manager

## Reporting

Report vulnerabilities privately via GitHub Security Advisories for this repository. Do not open public issues for credential or RCE reports.

## Dependabot

- Weekly npm updates for `tsm-console/`
- Weekly GitHub Actions updates
- Monthly pip updates for `backend/`

Review https://github.com/ATphobia22/Tri-State-Systems-Manager/security/dependabot before merging production images.

## Hardening rules

1. Never commit tokens, PATs, or cloud keys.
2. Workflows default to `permissions: contents: read` unless a job documents otherwise.
3. `npm install` in CI should prefer lockfile (`npm ci`) once `package-lock.json` is authoritative.
4. AI assist / Chrome built-in AI is presentation-only (`AI_ASSIST`); never writes Evidence Ledger.
5. Human authority remains final for LOMA/FARA/floodway determinations.

## Remediation status

Historical security alerts must be verified against the current GitHub Security/Dependabot state before release. The repository does not treat an old alert snapshot as proof of current vulnerability status.

Current controls include:

- `.github/dependabot.yml` for automated dependency updates
- pinned GitHub Actions references in production workflows
- lockfile reproducibility and dependency-integrity gates
- OIDC PKCE/nonce validation and confidential token-endpoint authentication
- operation-level authorization for privileged mutations
- provenance and quarantine boundaries for community submissions
- authoritative source URL/path allowlisting
- non-root container runtime and readiness gates
- deployment credentials excluded from source control

If GitHub reports a new dependency vulnerability, merge the vendor/Dependabot remediation only after the full repository gates pass.