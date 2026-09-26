# Tri-State Systems Manager — Production Deployment

## Verified production path

The deployable application in the repository is the Vite console under `tsm-console/`.
The production build contract is:

1. Node.js 22.
2. Public npm registry: `https://registry.npmjs.org`.
3. `npm ci` from `tsm-console/`.
4. Lockfile provenance and reproducibility checks.
5. Repository integrity gate.
6. Parse gate.
7. TypeScript gate.
8. Test suite.
9. Production Vite build.
10. `tsm-console/dist/index.html` artifact validation.

The repository workflow `.github/workflows/deploy-pages.yml` executes these gates and uploads the production artifact on every `main` push.

## GitHub Pages activation

Repository Pages configuration remains an explicit administrative control:

1. Open the repository **Settings → Pages**.
2. Set the Pages source to **GitHub Actions**.
3. Add repository variable `TSM_PAGES_ENABLED` with value `true` under **Settings → Secrets and variables → Actions → Variables** when enabling automatic `main`-push deployments.

The workflow also exposes a real **Run workflow** control through `workflow_dispatch` with a `deploy_pages` boolean input.

### GitHub Pages enablement

The workflow performs a Pages preflight before deployment. If the site already exists, the normal `GITHUB_TOKEN` path is used. If Pages has never been enabled, automatic first-time enablement requires repository secret `TSM_PAGES_ADMIN_TOKEN` containing a fine-grained personal access token with **Pages: write** and **Administration: write**. The safer one-time alternative is to open **Settings → Pages** and select **GitHub Actions**. The secret is never printed, committed, or used for ordinary repository checkout operations.

### Connector-safe owner dispatch

The GitHub connector used by TSM does not expose the GitHub Actions workflow-dispatch POST operation. To avoid requiring a raw token or bypassing connector security boundaries, the repository provides an audited owner-only command path:

1. Create or use a repository issue.
2. Add the exact comment `/deploy-pages` from the repository owner account.
3. The workflow accepts only that exact command from `github.repository_owner` and ignores pull-request comments.
4. The workflow performs the same production verification and Pages deployment path.
5. The workflow posts its build/deploy result, run URL and published URL (when available) back to the issue.

This command path is an explicit operator action. It does not expose, copy, or commit GitHub credentials.

## Local production verification

```bash
cd tsm-console
npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org
npm run check:integrity
npm run check:parse
npm run check:type
npm run test:all
npm run build
```

The resulting production files are in `tsm-console/dist/`.

## Backend deployment status

The historical `scripts/deploy.sh` referenced a Docker Compose stack that is not present in the current `main` tree. That stack is therefore not treated as a valid production deployment target. The production contract now targets the Vite console until a verified backend/Compose deployment manifest is restored.

Do not treat the frontend artifact as proof that API, WebSocket, PostGIS, telemetry, or other backend services are deployed.
