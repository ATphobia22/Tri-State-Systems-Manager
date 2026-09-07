# TSM Reliability and Real-Time Data Fabric Operations

## Operating principle
TSM separates **transport health**, **data freshness**, **data authority**, and **software provenance**. A successful HTTP request does not make a record LIVE. A delayed or stale last-known-good observation remains useful evidence but is never presented as current.

## Runtime states
- `healthy`: recent successful transport interaction.
- `degraded`: recent transport failures below circuit threshold.
- `circuit_open`: repeated failures temporarily suppress requests.
- `unknown`: no health observation yet.
- `fresh`: observation is inside its source-specific freshness window.
- `delayed`: observation exceeds the freshness window but remains within twice that window.
- `stale`: observation exceeds twice the freshness window.
- `unknown`: observation/retrieval timestamp is absent or invalid.

Transport health and freshness are independent. A healthy provider can return stale data; an unavailable provider can leave a previously retrieved record in the evidence store.

## Source freshness policy
Hydrologic observations default to 15 minutes; NOAA forecasts default to 60 minutes; FEMA NFHL, Indiana GIS, and USACE NLD default to 24 hours; USGS National Map product catalogs default to 7 days. These are operational freshness classifications, not assertions about legal validity or publication schedules. The source's own timestamps and product metadata remain authoritative.

## HTTP reliability
The bounded client:
1. rejects oversized responses;
2. fails fast on non-retryable 4xx responses;
3. retries bounded 408/425/429/5xx failures;
4. honors `Retry-After` up to a 60-second bound;
5. uses exponential backoff;
6. records a per-host circuit breaker;
7. exposes circuit state through `/api/data-sources/health`.

No infinite retry loop is permitted.

## API health
- `GET /health`: process/build identity and basic service health.
- `GET /ready`: internal readiness contract. Upstream source outages do not automatically make the API itself unavailable.
- `GET /api/data-sources/health`: source telemetry and circuit state.
- `GET /api/hydrologic/live`: current upstream observation when available; callers must inspect timestamps and source metadata.

No endpoint exposes secrets. Build identity is the Git SHA when provided by the deployment environment.

## Evidence rules
Authoritative observations retain provider, source URI, source identifier, observation time, retrieval time, units, CRS, vertical datum, quality/status, and content hash. Raw gage height remains `GAGE_DATUM`; NAVD88 water-surface elevation is only derived when an explicitly matched published zero is configured. Derived engineering outputs remain model outputs and are not regulatory determinations.

## npm supply-chain controls
CI uses Node 22 and exact npm `10.9.2`, matching `tsm-console/package.json`. Project dependencies are installed only with `npm ci` from the committed lockfile. CI separately runs:
- dependency/lockfile integrity validation;
- remote `npx` policy validation;
- CycloneDX SBOM generation;
- `npm audit --audit-level=high`;
- `npm audit signatures` as evidence (signature availability is not silently converted into a false security claim);
- repository gates, typecheck, build, and tests.

CI does not run `npm audit fix`, because automatic dependency mutation would defeat reproducibility. The npm cache is not evidence storage.

## Maintenance
The scheduled reliability workflow runs `npm doctor` and `npm cache verify`. Failures should be investigated as environment/registry/cache issues rather than worked around by changing the lockfile.

## npm repository provenance
`ATphobia22/npm` is an archived repository that points to the upstream npm CLI project. TSM does not vendor or execute it. The current npm CLI documentation and upstream npm CLI are the references for npm behavior.

## Trusted publishing
If TSM later publishes an npm package, prefer npm trusted publishing/OIDC over long-lived registry tokens. This application currently does not add a package-publishing workflow.

## Operational commands
```bash
cd tsm-console
npm ci --no-audit --no-fund
npm run check:dependency-integrity
npm run check:npx-policy
npm run generate:sbom
npm audit --audit-level=high
npm audit signatures
npm run test:ingestion
npm run ci:full
```

## Failure handling
Do not replace failed authoritative-source calls with mock values. Preserve the failure state, surface delayed/stale last-known-good evidence where appropriate, and retain provenance. If a source repeatedly fails, investigate provider availability, rate limiting, schema changes, network policy, and circuit state before changing source adapters.
