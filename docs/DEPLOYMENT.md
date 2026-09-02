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

The repository's current Actions credential cannot enable GitHub Pages site configuration automatically. The first activation therefore requires repository administration:

1. Open the repository **Settings → Pages**.
2. Set the Pages source to **GitHub Actions**.
3. Add repository variable `GITHUB_PAGES_ENABLED` with value `true` under **Settings → Secrets and variables → Actions → Variables**.
4. Push to `main`, or manually dispatch **TSM Production Build & Pages Deploy**.

After activation, the deployment job is enabled by the repository variable and uses the Pages deployment environment.

Expected project-site form: `https://ATphobia22.github.io/Tri-State-Systems-Manager/`.

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
