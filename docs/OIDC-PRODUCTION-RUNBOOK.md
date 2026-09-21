# TSM Production OIDC Runbook

## Scope

This runbook configures the **server-side OIDC session boundary** for a hosted TSM deployment. It does not create or store real agency credentials in the repository.

TSM ordinary public/read functionality remains usable without an account. Only privileged evidence, ingestion, engineering, and ledger mutations require the authenticated boundary.

## 1. Identity-provider values

Provide these values through the deployment platform's environment/secret manager:

| Variable | Classification | Requirement |
|---|---|---|
| `OIDC_ISSUER` | configuration | Exact HTTPS issuer |
| `OIDC_AUDIENCE` | configuration | API audience contained in access tokens |
| `OIDC_CLIENT_ID` | configuration | Confidential OIDC client |
| `OIDC_CLIENT_SECRET` | secret | Client credential when the IdP requires it |
| `OIDC_REDIRECT_URI` | configuration | Exact registered `/api/auth/callback` URL |
| `TSM_SESSION_SECRET` | secret | At least 32 characters |
| `CORS_ORIGIN` | configuration | One exact trusted browser origin |
| `TSM_OPERATOR_ROLE` | configuration | Default `tsm-operator` |
| `TSM_REVIEWER_ROLE` | configuration | Default `tsm-reviewer` |

Generate a session secret with:

```bash
openssl rand -base64 48
```

Never put the generated value in Git, an image layer, an artifact, or a workflow log.

## 2. Keycloak configuration

For Keycloak, create an OIDC client dedicated to TSM.

Recommended production settings:

- **Client authentication:** enabled (confidential client).
- **Standard flow:** enabled.
- **PKCE:** S256.
- **Implicit flow:** disabled.
- **Direct access grants:** disabled.
- **Valid redirect URI:** one exact callback URL, for example `https://api.example.gov/api/auth/callback`.
- **Web origin:** one exact browser origin, for example `https://tsm.example.gov`.
- **Post-logout redirect URI:** the approved application origin.
- **Roles:** create only the minimum `tsm-operator` and `tsm-reviewer` roles required by the deployment.
- **Audience:** configure an Audience protocol mapper so the API's configured audience is present in the access token.

Do not use wildcard redirect URIs or wildcard web origins for an agency deployment.

## 3. TSM browser session flow

1. Browser navigates to `GET /api/auth/login`.
2. TSM generates a transaction-specific PKCE verifier and S256 challenge.
3. TSM stores the transaction in an encrypted HttpOnly cookie.
4. The browser authenticates at the OIDC provider.
5. Provider returns an authorization code to `GET /api/auth/callback`.
6. TSM exchanges the code server-side.
7. TSM validates the resulting access token's signature, issuer, audience, expiration, not-before, subject, and roles.
8. TSM creates an encrypted HttpOnly Secure `__Host-` session cookie.
9. Browser JavaScript calls `GET /api/auth/session` to learn only the authenticated subject/roles.
10. Protected mutations use the cookie session; browser JavaScript never receives the access or refresh token.

This architecture is intentionally selected to keep OAuth tokens out of browser storage and to centralize server-side authorization.

## 4. CSRF and cross-origin deployment

Cookie-authenticated mutations require:

- the exact configured `Origin`;
- `X-TSM-CSRF: 1`;
- `credentials: include` from the browser.

Use `TSM_COOKIE_SAMESITE=Lax` or `Strict` when frontend and API are same-site.

If the frontend and API are intentionally on different sites, use:

```text
TSM_COOKIE_SAMESITE=None
TSM_COOKIE_SECURE=true
```

and keep `CORS_ORIGIN` exact. Do not use `Access-Control-Allow-Origin: *` with authenticated cookies.

## 5. Production readiness test

After injecting real values:

```bash
docker compose -f tsm-console/docker-compose.yml config
curl --fail https://api.example.gov/ready
curl --fail https://api.example.gov/api/auth/health
```

The readiness endpoint must report `ready: true`. If required OIDC/session configuration is missing, readiness fails closed with `AUTH_CONFIGURATION_INCOMPLETE`.

Then execute the full repository CI and container gates before demonstration.

## 6. Operational controls

- Put the API behind HTTPS/TLS termination and a WAF or equivalent ingress control.
- Restrict administrative/privileged endpoints at the network edge where practical.
- Monitor authentication failures, authorization failures, readiness failures, upstream circuit failures, and repeated validation failures.
- Retain the release SHA, SBOM, provenance/attestation, deployment configuration fingerprint, and deployment timestamp.
- Rotate OIDC client credentials and `TSM_SESSION_SECRET` according to the agency's credential policy.
- Treat loss of the session secret as a security incident; rotate it and terminate active sessions.
- Keep agency authorization, engineering review, permit decisions, and official records under the responsible human/public authority.

## 7. Acceptance boundary

A successful software deployment gate proves that the implementation is configured and verified against its stated technical controls. It does **not** by itself constitute an agency ATO, regulatory certification, permit decision, engineering seal, records approval, or cybersecurity authorization.
