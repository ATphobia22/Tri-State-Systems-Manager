# TSM Security Deployment Baseline

This document defines the minimum security configuration for a hosted or government-review deployment of Tri-State Systems Manager (TSM).

## Free/community model

TSM application code and community-facing read functionality remain free to use. The security baseline does not require a paid identity provider: any OIDC provider implementing standard JWT/JWKS discovery can be used, and self-hosted Keycloak is supported as a no-license-cost option.

## Authentication boundary

Production and hosted deployments use:

- `TSM_AUTH_MODE=required`
- `OIDC_ISSUER`
- `OIDC_AUDIENCE`
- optional explicit `OIDC_JWKS_URL`
- `TSM_OPERATOR_ROLE`
- `TSM_REVIEWER_ROLE`

Hosted browser authentication now uses a server-managed OIDC session gateway. The browser receives only an encrypted `HttpOnly`, `Secure`, `__Host-` session cookie; access and refresh tokens are not stored in `localStorage` or `sessionStorage`. The OIDC Authorization Code flow uses PKCE S256, server-side discovery metadata, exact configured redirect URI, and server-side token validation. Browser-authenticated mutations additionally require the configured `Origin` and `X-TSM-CSRF: 1` header.

The API validates:

1. JWT structure.
2. RS256 algorithm.
3. signing-key `kid`.
4. JWKS-derived RSA public key.
5. JWT signature.
6. issuer.
7. audience.
8. expiration and not-before timestamps.
9. non-empty subject.

The browser is not trusted as the authority for reviewer identity.

## Protected mutations

The following routes require a verified access token:

- `POST /api/evidence`
- `POST /api/evidence/verify`
- `POST /api/v1/engineering/compensatory-storage`
- `POST /api/ingest/hydrologic`
- `POST /api/ingest/usgs`
- `POST /api/ingest/nwps`
- `POST /api/ledger/append`

The ledger publication route additionally requires `TSM_REVIEWER_ROLE`.

For ledger publication, the authenticated OIDC subject must exactly match `human_authorization.reviewer_identity`. The server passes that identity into the governance transition and rejects mismatches.

## Production OIDC configuration

Required server configuration for the browser-session/BFF path:

- `OIDC_ISSUER` — exact HTTPS issuer URL.
- `OIDC_AUDIENCE` — API/resource-server audience present in access tokens.
- `OIDC_CLIENT_ID` — server-side confidential OIDC client identifier.
- `OIDC_CLIENT_SECRET` — confidential-client credential; inject only from the deployment secret manager.
- `OIDC_REDIRECT_URI` — exact registered callback URL, normally `/api/auth/callback`.
- `TSM_SESSION_SECRET` — at least 32 characters; store only in the deployment secret manager.
- `CORS_ORIGIN` — one exact trusted browser origin; never `*` when cookies are enabled.
- `TSM_COOKIE_SAMESITE` — `Strict`/`Lax` for same-site deployments; `None` only when a deliberately cross-site frontend/API deployment is required, with HTTPS and `Secure`.

For Keycloak, configure a confidential OIDC client with Standard Flow enabled, Direct Access Grants disabled, Implicit Flow disabled, PKCE S256 enabled, and exact valid redirect/web origins. Configure an Audience mapper so the issued access token contains the API value configured as `OIDC_AUDIENCE`; Keycloak documents Audience protocol mappers for this purpose.

The browser starts login at `GET /api/auth/login`; the server stores the PKCE transaction in an encrypted HttpOnly transaction cookie, exchanges the authorization code server-side at `GET /api/auth/callback`, validates the resulting access token, and establishes the protected session. This follows the current browser-based OAuth BFF guidance, which recommends keeping OAuth tokens out of browser application code and using protected cookie sessions.

### Keycloak production checklist

1. Create realm `tsm` (or the agency-approved realm name).
2. Create confidential client `tsm-console-bff`.
3. Enable Standard Flow / Authorization Code.
4. Enable PKCE with S256.
5. Disable Implicit Flow and Direct Access Grants.
6. Register one exact `OIDC_REDIRECT_URI`, e.g. `https://api.example.gov/api/auth/callback`.
7. Register the exact browser origin under Web Origins.
8. Create API audience `tsm-console-api` and add an Audience mapper to the access token, or use the approved API client as the audience.
9. Create realm/client roles matching `TSM_OPERATOR_ROLE` and `TSM_REVIEWER_ROLE`.
10. Assign only the minimum required roles to approved users/groups.
11. Store the generated client secret and `TSM_SESSION_SECRET` in the deployment secret manager; never put either in Git.
12. Verify discovery, JWKS, token issuer, audience, expiration, and role claims against the deployed provider before enabling privileged workflows.

The application intentionally does not invent or embed a real identity-provider URL, client secret, role assignment, or agency credential. Those values are deployment-specific and must be supplied by the responsible operator.

## Development

A local-only bypass is available with:

```text
TSM_AUTH_MODE=disabled
```

This must never be used for hosted, shared, public, or government-review deployments.

## Secrets

Do not commit:

- database passwords;
- OIDC client secrets;
- signing private keys;
- deployment tokens;
- GitHub tokens;
- populated `.env` files.

Use environment injection or a deployment secret manager.

## Runtime

The canonical runtime is `tsm-console/Dockerfile`.

The image:

- installs dependencies during image build;
- runs as non-root user `tsm`;
- contains the built frontend;
- contains the Node API;
- exposes health/readiness behavior;
- does not install packages at container startup.

## Evidence

SHA-256 values are integrity seals. They are not substitutes for identity authentication or digital signatures.

Human authorization is bound to the authenticated OIDC subject before an artifact can cross the publication boundary.

## Release gate

Before an agency demonstration:

1. Run the complete CI pipeline.
2. Verify all security-boundary tests pass.
3. Verify the exact commit SHA under review.
4. Generate and retain the SBOM.
5. Verify artifact provenance/attestation.
6. Verify dependency audit status.
7. Confirm no committed credentials exist.
8. Confirm `TSM_AUTH_MODE=required`.
9. Record the configured issuer/audience without publishing credentials.
10. Record unresolved limitations rather than representing engineering evidence as regulatory certification.

TSM is engineering decision-support software. Agency authority, regulatory determinations, permit decisions, and official records remain under the responsible human/public authority.
