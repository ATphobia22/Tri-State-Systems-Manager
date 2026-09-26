# TSM SAST / Supply-Chain Stack Guidance

**Date:** 2026-09-24  
**Principle:** Prefer tools that fit the stack and pass the **SHA-pinned action** gate.

## Recommended baseline

| Layer | Tool | Role for TSM |
|-------|------|----------------|
| **1 — Baseline SAST** | **CodeQL** (GitHub native) | JS/TS + Python deep analysis on PR/push; results in Security tab |
| **2 — Fast / custom rules** | **Semgrep** (optional later) | Project-specific patterns (e.g. fail-closed gates, no silent NAVD88 conversion) |
| **3 — Dependencies** | Existing **Dependabot** + optional OSV | Keep action/npm pins current |
| **4 — Containers** | **Trivy** only if Docker images are release artifacts | Scan images before publish |
| **5 — Python-only** | Bandit only if CodeQL gaps appear | Avoid duplicate noise |

**Start with CodeQL only.** Add Semgrep when you have 3–5 concrete custom rules worth maintaining.

## Enable on GitHub

1. **Settings → Code security → CodeQL** → Default setup **or** rely on `.github/workflows/codeql.yml` (advanced).
2. Do not enable Default *and* Advanced on the same languages without understanding override behavior.
3. Keep Dependabot open for `github/codeql-action` SHA bumps.

## Not in scope yet

- Snyk commercial unless you adopt a paid plan  
- Pysa (heavy; CodeQL covers most Python flow needs for this repo size)
