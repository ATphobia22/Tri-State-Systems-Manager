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

## Remediation status (2026-08-31)

GitHub reported 1 critical Dependabot alert on default branch after push `75dee33`.  
Actions taken:

- Added `.github/dependabot.yml` for automated patches
- Confirmed workflows use `pull_request` (not `pull_request_target`) and minimal permissions on open-world-twin
- Generated/refreshed `tsm-console/package-lock.json` for reproducible installs
- Recommend operator open the Dependabot alert UI, accept the security update PR, and run `npm ci` locally

If the alert is a transitive package, prefer Dependabot’s proposed bump over manual deep pins unless CI fails.
