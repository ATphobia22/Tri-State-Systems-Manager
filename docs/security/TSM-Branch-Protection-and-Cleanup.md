# TSM Branch Protection & Cleanup Guide

**Repo:** `ATphobia22/Tri-State-Systems-Manager`  
**Date:** 2026-09-24

## GitHub branch protection (rulesets)

GitHub supports classic **branch protection rules** and newer **rulesets**. Rulesets can stack, are visible to readers, and support `evaluate` mode (audit without blocking).

### Recommended settings for `main`

| Rule | Purpose |
|------|--------|
| **Block force pushes** (`non_fast_forward`) | Protect history integrity |
| **Block branch deletion** (`deletion`) | Protect default branch |
| **Pull request path** | Prefer changes via PR (even for solo work) |
| **Dismiss stale reviews** | Re-review after new commits |
| **Required status checks** | Only after checks have run ≥1× on `main` in last 7 days |

**Do not** require status checks by name until those check names appear in the UI. Requiring a missing check **blocks all merges**.

### Suggested required checks (add when stable)

- Parse / action-pin gate job name (from `tsm-parse-gate` or `ci.yml`)
- CodeQL Analysis (after first successful run)
- Primary CI pipeline job that must stay green

Path: **Settings → Rules → Rulesets** (or **Branches**).

### Solo-maintainer note

Use a **bypass** for the repository admin role so you are never locked out. Start rulesets in **`evaluate`** mode, review the rule suite log, then switch to **`active`**.

### Auto-delete head branches

**Settings → General → Pull Requests → ☑ Automatically delete head branches**

Plus scheduled workflow: `.github/workflows/branch-cleanup.yml` (Dependabot/Renovate merged heads).

---

## GitLab comparison (auto-cleanup)

| Feature | GitLab | TSM on GitHub equivalent |
|---------|--------|---------------------------|
| **Delete merged branches** (UI bulk) | Code → Branches → More → Delete merged branches | Auto-delete head branches + cleanup workflow |
| **Protected branches** | Settings → Repository → Protected branches | Rulesets / branch protection |
| **Stale branch** | Active = commit in last ~3 months | Manual / scheduled API cleanup |
| **`glab repo prune`** | Deletes **local** branches whose MRs merged | `scripts/ci/cleanup-merged-branches.sh` |
| **Scheduled pipeline cleanup** | Custom CI + API | `branch-cleanup.yml` Monday cron |

GitLab does **not** magically delete remote feature branches on a timer for all projects without configuration; maintainers use protected-branch rules, “delete source branch” on merge, bulk “delete merged branches,” or scheduled jobs calling the API.

---

## CI / deploy honesty boundary

| Gate | Status in automation environment |
|------|----------------------------------|
| Action-pin validator | Passes when run locally in sandbox |
| Open PRs | Should be 0 after Dependabot merge pass |
| Full Actions matrix green | Requires GitHub-hosted runners + your secrets (OIDC, deploy keys, npm cache) |
| Desktop installers / Pages deploy | Need green workflows + any required environment secrets **you** configure under Settings → Secrets |

**Credentials:** The connected GitHub app can push/merge/rulesets within its token scope. It cannot install arbitrary secrets (Auth0, deploy keys, signing certs) into the repo for you. Add those under **Settings → Secrets and variables → Actions** yourself; never commit them.

---

## Operator checklist

1. Confirm ruleset **TSM main protection** exists (evaluate → active when ready).  
2. Enable **Automatically delete head branches**.  
3. Run **Branch cleanup** workflow once (Actions → Run workflow).  
4. Watch **CodeQL** + parse gate on latest `main`.  
5. Add only **passing** check names as required status checks.
