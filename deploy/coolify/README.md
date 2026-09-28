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

## Deployment triggers

### Path A — native Git provider webhook (no Actions secrets)

Coolify **Configuration → Webhooks** → enable Auto Deploy for `main`, then add the GitHub webhook (URL + secret) under the repository **Settings → Webhooks**. Pushes to `main` redeploy without storing Coolify credentials in GitHub Actions.

### Path B — Coolify Deploy API from GitHub Actions

Workflow: `.github/workflows/deploy-coolify.yml`

Coolify authenticates the deploy endpoint with a **Bearer** API token (permission: **deploy** only is enough).

1. Coolify → **Keys & Tokens → API Tokens** → create token with **deploy** permission (copy once).
2. Self-hosted: enable **API Access** under instance advanced settings if disabled.
3. Application → **Configuration → Webhooks** → copy **Deploy Webhook (auth required)**:

   `https://<coolify-host>/api/v1/deploy?uuid=<resource-uuid>&force=false`

4. GitHub → **Settings → Secrets and variables → Actions** → repository secrets:

| Secret | Value |
|--------|--------|
| `COOLIFY_DEPLOY_WEBHOOK_URL` | Full deploy URL including `uuid=` |
| `COOLIFY_API_TOKEN` | Full token string (`id\|secret` as shown by Coolify) |

Behavior:

- **Both secrets empty** → workflow exits 0 (soft-skip); Path A can still deploy.
- **URL set, token missing** → **fail closed** with a clear error.
- **Both set** → `GET` with `Authorization: Bearer …`; `--fail` on non-2xx.

Never put the token in the query string, workflow source, or logs.

Example (matches Coolify docs):

```bash
curl --request GET "$COOLIFY_DEPLOY_WEBHOOK_URL" \
  --header "Authorization: Bearer $COOLIFY_API_TOKEN"
```

`POST` with JSON `{"uuid":"…","force":false}` is also accepted by Coolify; TSM uses GET for the Actions path.

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
