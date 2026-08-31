# Tri-State Systems Manager — Credential & Secret Requirements

**Status:** Security baseline
**Updated:** 2026-08-31

## Principle

Store credentials only in the platform's secret manager or local development secret store. Never commit token values, private SSH keys, client secrets, recovery codes, or personal access tokens to the repository.

## Required for current application

| Credential | Required? | Storage | Scope | Notes |
|---|---|---|---|---|
| OIDC client secret | Conditional | server-side secret manager / local `.env` | Token exchange only | Required when `VITE_IDP_PROVIDER=oidc`; never expose to Vite/browser code. |
| OIDC audience | Conditional | environment/config | API audience | Non-secret configuration unless the identity provider treats it otherwise. |
| OIDC authority/client ID | Conditional | public runtime config | OIDC login | Client ID is not a secret; authority is configuration. |
| GitHub repository access | Yes for repository automation | Connected GitHub integration / SSH on developer device | Repository-specific read/write | Do not copy a PAT into source or `.env`. |
| FEMA/MSC/NFHL | No credential currently required | N/A | Public authoritative data | Use official public services; do not create a fake API credential. |
| Indiana GIO/INFIP | No credential currently required | N/A | Public authoritative data | Use official public services where available. |
| USGS/3DEP | No credential currently required | N/A | Public data access | Add credentials only if an official service specifically requires them. |

## GitLab

No GitLab connector is currently installed for this ChatGPT workspace, and the repository currently has no `GITLAB_TOKEN` dependency. Therefore **do not add a GitLab personal access token merely because one exists**.

If a GitLab mirror/CI integration is later approved, prefer a project or group token with the smallest required scope. For repository read/write over Git-over-HTTP, GitLab documents `read_repository` and `write_repository`; `api` is substantially broader and should not be used unless API operations actually require it. Tokens should have an expiration date and be limited to the required project/group. See the official GitLab token-scope documentation.

## GitHub token inventory supplied by project owner

The project owner reported two non-expiring GitHub tokens with broad classic scopes, including administration, repository deletion, organization administration, hooks, packages, workflow, user, and audit capabilities.

**These tokens are NOT registered in this repository and must not be copied here.** Their scope is substantially broader than the current application needs. Prefer the existing authenticated GitHub integration and device SSH identity for repository work. If an automation credential is later required, create a dedicated, expiring, least-privilege credential for the specific repository/workflow.

## iPhone / Working Copy SSH identity

- Key title: `Enclave@iPhone-11082026`
- Fingerprint: `SHA256:WEJAOtOhRSOiZzZZM3t/UNw9JP61dh5awwHMKtdG3q0`
- Added: 2026-08-11
- Provider: Working Copy
- Permission reported by owner: read/write

Only the fingerprint is recorded. The private key remains on the device and must never be committed or pasted into ChatGPT/repository files.

## Current `.env` contract

The current application template defines the following server-side secret/configuration variables:

- `IDP_TOKEN_URL`
- `IDP_CLIENT_SECRET` (secret)
- `IDP_AUDIENCE`
- `PORT`

See `tsm-console/.env.example`. Do not populate `.env.example` with real values.

## Credential onboarding checklist

1. Create the credential at the upstream provider.
2. Restrict it to the smallest resource and permission set.
3. Set an expiration/rotation date whenever the provider supports it.
4. Store it in the appropriate secret manager or local untracked `.env`.
5. Verify the application can operate without exposing it to browser bundles.
6. Add only the credential **name/requirement** to this matrix—not its value.
7. Rotate/revoke credentials immediately if a secret value is ever exposed.

## Prohibited repository contents

- GitHub PAT values
- GitLab PAT values
- OAuth client secrets
- Private SSH keys
- SSH passphrases
- API keys
- Database passwords
- Cloud access keys
- Signing private keys
- Recovery codes
- Session cookies

This file intentionally contains identifiers and requirements only; it contains no usable authentication secret.
