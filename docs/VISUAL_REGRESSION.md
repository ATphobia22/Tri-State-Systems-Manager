# PTDT v35 — E2E & Visual Regression

## Workflow
`.github/workflows/ptdt-e2e-visual.yml` — Node 20, parse/typecheck gate, optional Cypress, artifact upload on failure.

## Local baseline (when cypress-visual-regression installed)
```bash
cd tsm-console
npx cypress run --env visualRegressionType=base
```

## Deterministic frames
For multi-view / wave shaders, pass a **fixed** `time` uniform (not `clock.getElapsedTime()`) during snapshot capture to avoid false positives.

## Scripts
- `scripts/assemble_project.sh` — npm check + vite build
- `scripts/validate_shaders.sh` — structural WGSL gate
