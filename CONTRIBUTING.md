# Contributing to Tri-State Systems Manager

## Branch and PR conventions

- `main` is the canonical integration and release branch. It is the only
  deployment surface.
- Work happens on short-lived feature branches (`feat/...`, `fix/...`,
  `docs/...`). Branches land through pull requests; direct pushes to `main`
  are for automated CI fix-ups only.
- Stale or superseded branches are deleted after merge. Do not treat a
  feature branch as a deployment surface.
- Every PR must pass CI before merge. A red workflow is a blocker, not a
  suggestion.

## Fail-closed policy

TSM is fail-closed by design. This is the single most important rule in the
repo:

- Missing, stale, unverifiable, or insufficiently supported data stays
  **explicitly unavailable** — it is never replaced with zero, a guess, or a
  silently substituted value.
- A missing endpoint, empty required artifact, authority mismatch, or
  SHA-256 mismatch fails the job. Partial outputs are not releases.
- Do **not** weaken or bypass a failing gate to turn a workflow green. Green
  is only valid when the gates stay honest.

## No-fabrication rule

- Never fabricate buildings, flood events, elevations, roof forms,
  telemetry, professional certifications, or agency determinations.
- Visualizations are presentation, never evidence. A render can never
  silently become a measurement.
- Provisional or draft sources are labeled as such; they are never laundered
  into authoritative records.
- Software output is not PE/surveyor certification. Human authority remains
  final.

## Provenance

Every derived artifact records: source authority, dataset/version, vintage,
retrieval timestamp, CRS, vertical datum, model/software version, and
SHA-256. Retrieval date is not the product vintage.

## What to run

```bash
cd tsm-console && npm run ci:full   # full local gate suite
```

See `README.md` for the full system overview and `COMPLIANCE.md` for
authority boundaries.
