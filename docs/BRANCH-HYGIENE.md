# Branch hygiene

As of 2026-09-02, `main` is the integration line. The following remote branches are **candidates for deletion** after local confirmation (many were already merged via historical PRs):

```bash
git fetch --prune
git branch -r

git push origin --delete ci/lockfile-repair-2026-08-31
git push origin --delete feat/firm-18129c0265c-integration
git push origin --delete feat/point-township-anchor-2026-08-31
git push origin --delete feat/posey-benefit-first-platform
git push origin --delete feat/repository-scale-engineering-hardening-2026-08-31
git push origin --delete feature/open-world-twin-solar-flood-tiles
git push origin --delete fix/parse-gates
git push origin --delete integration/posey-final
git push origin --delete integration/repository-wide
git push origin --delete feat/external-capability-integration
```

Do **not** delete `main`. Prefer deleting only after `git log main --oneline` shows the work is present or intentionally abandoned.
