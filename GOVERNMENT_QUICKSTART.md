# Government / Agency Quick Start — Tri-State Systems Manager

**Repository:** https://github.com/ATphobia22/Tri-State-Systems-Manager  
**Console path:** `tsm-console/`  
**Node:** >= 22  
**Purpose:** Public-interest evidence, maps, and digital twin for Posey County / Tri-State River Valley.

## Principles

1. **Human authority remains final** — this system informs; it does not issue LOMA/LOMR or grant awards.
2. **No auto-filing** — FEMA Case 26-05-2022A is tracked only.
3. **Open source** — Apache-2.0; reproducible builds use the committed `package-lock.json` with `npm ci`.

## One-command local run

```bash
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager.git
cd Tri-State-Systems-Manager/tsm-console
npm ci
npm run check:parse
npm run check:type
npm run build
npm run preview
# open http://localhost:4173
```

### Development mode

```bash
npm run dev          # Vite on :5173
npm run proxy        # optional token proxy :8787
```

## What builds without credentials

| Command | Requires secrets? |
|---------|-------------------|
| `npm run check:parse` | No |
| `npm run check:type` | No |
| `npm run build` | No |
| `npm run preview` | No |
| `npm run scan:loma` | No (uses local catalog JSON) |
| OIDC / Auth0 | Yes — set `VITE_IDP_*` in `.env` from `.env.example` |

## Key operational facts (Bonebank node)

| Item | Value |
|------|------:|
| Address | 13101 Bonebank Road, Point Twp, Posey Co, IN |
| FIRM panel | **18129C0215C** (eff. 2014-11-05) |
| BFE | 375.0 ft NAVD88 |
| LAG | 377.2 ft NAVD88 |
| Δz | +2.2 ft |
| Active LOMC | **26-05-2022A** (Application ID 5918599025038) — IN PROGRESS |

## Support contacts (external)

- FEMA Map Info: 1-877-FEMA-MAP  
- MSC: https://msc.fema.gov  

## License / contribution

The repository is licensed under Apache-2.0; see `LICENSE`. Security reporting and dependency policy are documented in `SECURITY.md`.
