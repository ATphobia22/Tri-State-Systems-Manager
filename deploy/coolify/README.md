# TSM Coolify deployment

TSM uses **Coolify self-hosted** as the production API control plane. GitHub Pages remains the public static console.

## Coolify resource

Create one **Application** from this GitHub repository, or deploy the checked-in Compose definition:

- Repository: `ATphobia22/Tri-State-Systems-Manager`
- Branch: `main`
- Build method: **Docker Compose**
- Compose file: `deploy/coolify/docker-compose.yml`
- Build context: repository root
- API container port: `8787`
- Health check: `GET /ready`
- Auto-deploy: enabled for pushes to `main`
- Public domain: HTTPS only

The Compose definition requires `TSM_BUILD_SHA` so the API's provenance identity is explicit and provider-neutral.

## Required runtime variables/secrets

Set these in Coolify's environment/secret store:

- `SOURCE_COMMIT` — provided by Coolify as the exact deployed Git SHA; the Compose contract maps it to `TSM_BUILD_SHA`
- `OIDC_ISSUER`
- `OIDC_AUDIENCE`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `OIDC_REDIRECT_URI` — `https://<API-DOMAIN>/api/auth/callback`
- `TSM_SESSION_SECRET`
- `CORS_ORIGIN` — exact Pages origin: `https://atphobia22.github.io`
- `TSM_AUTH_MODE=required`

Do not commit secrets.

## GitHub Pages binding

Create repository variable `TSM_API_BASE_URL` containing the HTTPS API origin. The Pages workflow fails closed when it is absent or non-HTTPS.

The Pages deployment then polls `<TSM_API_BASE_URL>/ready` and requires:

1. `build_sha === GITHUB_SHA`
2. `auth_ready === true`
3. `required_internal_dependencies.oidc === true`

## Deployment trigger

Coolify's GitHub integration can auto-deploy on pushes to `main`. An optional GitHub Actions webhook can also trigger a Coolify deployment if `COOLIFY_DEPLOY_WEBHOOK_URL` is configured as a repository secret.

The repository intentionally stores no Coolify token or webhook URL.

## Infrastructure

Coolify is free/open-source software, but self-hosting still requires infrastructure you control. Current Coolify documentation lists 2 CPU cores, 2 GB RAM, and 10 GB disk as minimum control-plane requirements.

For government-facing production, use a hardened Linux host, restricted management access, TLS, encrypted backups, OS patching, monitoring, and documented recovery.

## Migration acceptance

Railway is not part of the TSM runtime contract. A release is migrated when:

- no Railway deployment/runtime references remain;
- Coolify reports the exact main SHA deployed;
- `/ready` reports that SHA and OIDC readiness;
- Pages deploy succeeds against the same SHA;
- browser/API integration checks pass.
