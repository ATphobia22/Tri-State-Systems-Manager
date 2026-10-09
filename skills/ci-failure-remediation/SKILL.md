# Skill: CI Failure Triage and Remediation

## Trigger
Use when a GitHub Actions run, parser, type checker, geospatial validation, browser smoke test, or release gate fails.

## Procedure
1. Identify the exact commit SHA, workflow run, job, step, and failing command.
2. Retrieve the full relevant log and reproduce the failure at the narrowest useful scope.
3. Classify the failure as source defect, flaky dependency/network, missing secret, source-data gap, runner/resource issue, or contract mismatch.
4. Patch the smallest root cause; do not weaken a validation gate merely to turn CI green.
5. Add a deterministic regression test or explicit diagnostic where practical.
6. Rerun the failing check, then all affected contract/type/build checks.
7. Report the exact commit, tests passed/failed, remaining blockers, and deployment state.
8. Keep merge, release, and production verification separate. Never claim green while required checks are queued or running.

## Safety invariants
Do not fabricate source data, hashes, provider credentials, deployment evidence, or external-service success. Never convert unknown values into observed values to satisfy a gate.
