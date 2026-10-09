# Contributing

## Engineering rules
- Keep TypeScript strict; do not introduce `any` to bypass a type error.
- Treat external inputs as untrusted and validate at boundaries.
- Never commit credentials, tokens, private datasets, or generated secrets.
- Preserve provenance and distinguish observed, derived, simulated, and rendered data.
- Keep changes scoped and add regression tests for bug fixes.

## Local checks

```bash
npm ci
npm run build:uacf
npm run test:uacf
npm run test:uacf-contracts
npm run test:evidence
npm run test:twin-fabric
npm run test:uacf-agent
npm run test:uacf-providers
npm run test:uacf-apps
npm run test:uacf-gateway
```

For geospatial changes, run the focused geospatial tests and validate CRS, datum, units, lineage, and geometry validity. Do not claim an end-to-end release until the release workflow and artifact verification pass.
