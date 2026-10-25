# Superseded-branch reconciliation — 2026-10-25

This integration is a history-preserving merge of two older branches whose code diverged before later repairs on main. Ancestry is retained without reverting newer scientific or government-data safeguards.

## feature/posey-government-evidence-gates-20261024
- The current main government-evidence boundary JSON, documentation, tests, and package manifests already include newer, more extensive contracts.
- Preserve main versions. Import only the independent path-scoped CI workflow `.github/workflows/posey-government-evidence-boundaries.yml`.
- Verify its two Node test suites on the integration commit.

## fix/transvoxel-coarse-scalar-correctness-20261023
- The old branch maps Transvoxel endpoints 9–12 to fine scalar samples [0, 2, 8, 6], inconsistent with its own row-major coarse coordinate layout.
- The newer main mesher uses [0, 2, 6, 8], correctly associating endpoint 11 with (0,1) -> sample 6, and endpoint 12 with (1,1) -> sample 8.
- Retain main mesher, case-bit permutation, six-orientation validations, and current tests; do not import obsolete implementation or fixtures.
- Full-county terrain integration is still NOT COMPLETE and requires measured seam/topology acceptance.

Both original heads are parents of this reconciliation commit, but no claim is made that the older code bodies were applied unchanged. Missing scientific evidence stays unavailable and no governmental determination is automated.
