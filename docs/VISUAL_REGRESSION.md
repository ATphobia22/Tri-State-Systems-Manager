# PTDT v35 — E2E & Visual Regression

## Workflow
`.github/workflows/ptdt-e2e-visual.yml` — Node 22, parse/typecheck gate, headed Chrome + Xvfb visual validation, screenshot/video evidence, and artifact upload on failure.

### Rendering policy
Final browser visualization is **headed**, using real Chrome compositing on a virtual display in CI. The production application itself always renders normally in the user's browser; CI does not substitute Cypress headless mode for visual validation.

Headless tools remain permitted only for non-visual preprocessing/data operations. They are not the authoritative path for cinematic frame validation.

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
