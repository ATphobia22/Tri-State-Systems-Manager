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
