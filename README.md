# Tri-State Systems Manager (TSM)

**Public-interest engineering decision-support system** for the Ohio–Wabash Tri-State River Valley  
**Anchor site:** 13101 Bonebank Road, Point Township, Posey County, Indiana (APN `65-19-08-100-008.001-010`)  
**License:** Apache-2.0 · **Charter:** Beverly Ann Tucker Memorial Stewardship  
**HEAD (document as of):** 2026-09-02

> **Governing rule:** Technology informs people; it does not silently govern people.  
> **Human authority is final** (ADR-004). TSM does **not** issue LOMA, No-Rise, FARA, or floodplain permits.

---

## 1. Mission for government agencies

TSM is a **fail-closed, evidence-first cockpit** so local, state, and federal practitioners can:

1. Observe live river stage with correct **vertical datum hygiene**
2. Compare structure elevations (BFE / LAG / FFE) in **NAVD88** only after conversion
3. Cite **Indiana 312 IAC 10**, Posey ordinances, and FEMA NFIP products without inventing determinations
4. Preserve a **Merkle / EvidenceArtifact** chain for audits
5. Operate under **Zero-Trust** identity (Keycloak PKCE public client) with **no proprietary cloud AI secrets** in-repo

---

## 2. Four-plane architecture (ADR-005)

| Plane | Role | Mutates governance? |
|-------|------|---------------------|
| **Evidence & Data Governance** | USGS / NOAA / FEMA / IGIO ingestion, SHA-256, provisional flags | Only via human-gated append |
| **Scientific & Simulation** | Models, CRS/datum, uncertainty, Class-2 LiDAR support | No auto-regulatory write |
| **Governance & Decision** | Jurisdiction rules, ADR-004/006 gates, citations | Human final |
| **Public Visualization** | React cockpit, MapLibre, engineering-sim HUD | Visualization only |

**Agentic policy (ADR-006):** default **S1** (no agency). **S2** = prescribed tools + human gate. **S3** deferred.

---

## 3. Authoritative site mathematics (Bonebank)

All elevations **NAVD88** unless labeled otherwise.

| Quantity | Value | Note |
|----------|-------|------|
| BFE | **375.0 ft** | Base Flood Elevation |
| LAG | **377.2 ft** | Lowest Adjacent Grade |
| **LAG − BFE clearance** | **+2.2 ft** | Site lock |
| FFE | **382.5 ft** | Finished Floor Elevation |
| Berm crest | **379.8 ft** | |
| Horizontal CRS | **EPSG:2966** | NAD83 / Indiana West (ftUS) |
| Vertical datum | **NAVD88** | Site geometry only |
| Indiana freeboard (practice) | **+2.0 ft** | Separate from LAG−BFE clearance |
| FEMA floodway No-Rise | **0.00 ft** | or CLOMR/LOMR |
| IDNR adverse effect | **0.15 ft** | 312 IAC 10-2-3 |
| Posey compensatory storage | **1.0×** equal volume | Subdivision ordinance |

### Gage height → water-surface elevation

```
WSE_NAVD88 ≈ gage_height_ft + gage_zero_navd88_ft
```

Raw USGS parameter **00065** / NWS observed primary is **GAGE_DATUM**, never auto-labeled NAVD88.

| ID | Name | Gage zero NAVD88 | Source (2026-09-02) |
|----|------|------------------|---------------------|
| **03378500** | Wabash @ New Harmony | **352.71 ft** | USGS site `alt_va` / NAVD88 |
| **03322000** | Ohio @ Evansville | **328.32–328.38 ft** | USGS 328.32; NWS EVVI3 328.38 |
| **MTVI3** | Ohio @ Mount Vernon | **318.59 ft** | NWS vertical datum table |
| **UNWK2 / 03322420** | John T. Myers L&D | **311.31 ft** (NWS) / **310.95 ft** (USGS alt) | Prefer product-matched zero |

Example: New Harmony stage **8.23 ft** (live sample) → WSE ≈ **360.94 ft NAVD88** — still **below** Bonebank BFE 375; do not treat as structure inundation without PE review.

---

## 4. Government agencies, tools, and sources

### Federal

| Agency | Products used in TSM |
|--------|----------------------|
| **FEMA** | NFHL MapServer, MSC, FIRM/FIS, LOMC; CID **180209**; panel **18129C0300C** (NFHL REST 2026-09-02, EFF 2014-11-05) |
| **USGS** | NWIS IV/DV/site; gauges 03378500, 03322000, 03322420 |
| **NOAA / NWS** | NWPS / AHPS gauges MTVI3, UNWK2, EVVI3; vertical datum tables |
| **USACE** | John T. Myers Locks & Dam (Louisville District); navigation context |
| **NIST** | AI RMF (Govern–Map–Measure–Manage); SP 800-207 Zero Trust |

### State (Indiana)

| Entity | Role |
|--------|------|
| **IDNR Division of Water** | 312 IAC 10, IC 14-28-1 / 14-28-3, INFIP, Best Available Floodplain, FARA |
| **Indiana GIO** | elevation.gio.in.gov QL2 LiDAR |
| **Posey County** | Flood Hazard Ordinance; Subdivision Ordinance (equal-volume fill offset); APC / Floodplain Administrator |

### Conservation nodes (Posey)

- **Hovey Lake FWA** (~7,404 ac) — IDNR Fish & Wildlife  
- **Twin Swamps Nature Preserve** (~598 ac) — IDNR Nature Preserves  
- Registry: `tsm-console/data/posey/idnr-posey-registry.json`

### NFHL MapServer layers (selected)

Base: `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer`

| ID | Name |
|----|------|
| 3 | FIRM Panels |
| 28 | Flood Hazard Zones |
| 16 | Base Flood Elevations |
| 1 / 2 | LOMRs / LOMAs |
| 14 | Cross-Sections |
| 23 | Levees |

### OSS runtime stack (credential-minimized)

| Need | Choice |
|------|--------|
| IAM | Keycloak (Apache-2.0), Authorization Code + **PKCE**, public client |
| Maps | MapLibre GL JS (BSD-3) |
| Local AI | Ollama / llama.cpp (MIT) — optional, offline |
| Tiles path | Martin / PMTiles / PostGIS (scale-up) |

---

## 5. Repository map

```
.
├── .github/workflows/     # ci, parse-gate, quantum, deploy-pages, firm, geospatial, …
├── tsm-console/           # React Router v7 SPA + Node token-proxy + ingestion
│   ├── src/lib/           # gage-datums, firm-panel-ssot, jurisdiction-rules, stage, auth
│   ├── src/components/    # StageAuthorityBanner, EngineeringSimSettings, RootLayout
│   └── server/            # evidence store, workers, token-proxy
├── backend/               # Python gov helpers / site constants
├── data/                  # LOMC, Posey catalogs, staged inventories
├── docs/                  # ADRs, NFHL/USGS guides, visual doctrine, analytics
├── scripts/               # CI gates, health checks
├── tsm-*-schema*.json     # Data contract + EvidenceArtifact schemas
├── tsm-authority-registry-v35.json
├── tsm-site-constants-13101-bonebank.json
└── GOVERNMENT_QUICKSTART.md
```

### Key code contracts

| File | Purpose |
|------|--------|
| `tsm-console/src/lib/gage-datums.ts` | Published zeros + conversion |
| `tsm-console/src/lib/firm-panel-ssot.ts` | FIRM **18129C0300C** SSOT |
| `tsm-console/src/lib/jurisdiction-rules.ts` | 0.00 / 0.15 ft, Posey **1.0×** |
| `tsm-console/server/ingestion/workers.mjs` | Fail-closed OBSERVATION ingest |
| `docs/ADR-006-*.md` | Agentic ladder |
| `docs/NFHL-REST-AND-USGS-WATER-TOOLS.md` | API recipes |

---

## 6. Quick start (operators)

```bash
git pull origin main
cd tsm-console
npm ci
npm run proxy    # :8787 OIDC/ledger assist
npm run dev      # :5173 cockpit

# Observation-only health (no governance write)
node scripts/hydrologic-health-check.mjs
```

Identity: configure Keycloak public client + PKCE per `.env.example` / `GOVERNMENT_QUICKSTART.md`.  
**No** Auth0/OpenAI/Mapbox secrets required for core operation.

---

## 7. CI / workflows

Primary pipeline: `.github/workflows/ci.yml`

- Node 22, `npm ci`, capability / boundary / parse / typecheck / build / test  
- **Commit binding** on `main` push: `git fetch origin main --depth=1` then HEAD == `GITHUB_SHA` == `FETCH_HEAD`  
- Additional workflows: parse-gate, quantum-ci, deploy-pages, geospatial, firm panel, container

If Actions is red: open the failed job log first; do not weaken fail-closed gates to force green.

---

## 8. Branch hygiene (run locally with push rights)

Merged feature branches still present on origin should be deleted after confirm:

```bash
git push origin --delete ci/lockfile-repair-2026-08-31
git push origin --delete feat/firm-18129c0265c-integration
git push origin --delete feat/point-township-anchor-2026-08-31
git push origin --delete feat/posey-benefit-first-platform
git push origin --delete feat/repository-scale-engineering-hardening-2026-08-31
git push origin --delete feature/open-world-twin-solar-flood-tiles
git push origin --delete fix/parse-gates
git push origin --delete integration/posey-final
git push origin --delete integration/repository-wide
# optional leftover:
git push origin --delete feat/external-capability-integration
```

Keep **`main`** as the sole long-lived line of truth.

---

## 9. What TSM must never do

- Auto-file LOMA / LOMR / CLOMR  
- Label raw gage height as NAVD88  
- Collapse observation into regulatory determination  
- Store proprietary IdP client secrets in the browser path  
- Treat NFHL identify as a sealed LOMA  
- Run decorative open-world animation as “engineering truth”

---

## 10. Compliance pointers

- `COMPLIANCE.md` · `SECURITY.md` · `GOVERNMENT_QUICKSTART.md`  
- NIST AI RMF mapping in technical addenda / ADR set  
- Evidence schemas: `tsm-evidence-artifact-schema-v1.0.0.json`, `tsm-data-contract-schema-v1.0.0.json`

**Contact for sealed survey / LOMA packages:** licensed PE + Posey Floodplain Administrator + IDNR as required by statute.

---

*Tri-State Systems Manager — built to serve the people of the Tri-State River Valley with science, evidence, and humility under law.*
