# Repo finish checklist — 2026-10-15

**Purpose:** Honest register of what is complete on `main` versus what requires a licensed host (Windows + UE 5.8, HEC solvers, production API).

**Principle:** Technology informs people; human authority remains final. Do not claim Level-5 twin, LOD4 interiors, continuous live 4D, or regulatory determinations.

---

## A. Closed on `main` (web / evidence plane)

- [x] GitHub Pages SPA (MapLibre twin, terrain, FEMA/BAFM/NOAA opt-in)
- [x] Self-hosted 3D Tiles 1.1 terrain + buildings (DERIVED; validators path documented)
- [x] Twin Scope B: VerticalContextHud, GEOID18 AOI educational panel, URL state, review pitch
- [x] Twin Scope C: multi-station button-only water levels (03378500, 03322000, 03322420)
- [x] Local dams catalog with **official NID API coordinates** (IN00516, IN03354, IN00397, IN03797, IN00631, KY03060)
- [x] Fail-closed stage / gage-zero / evidence gates (no invented WSE)
- [x] GEOID18 bias vs tilt documentation
- [x] IBM Quantum opt-in DERIVED/quarantine contracts
- [x] CodeQL core path fixes + FarmVibes paths-ignore
- [x] NOAA CloudGIS catalog + opt-in overlays (GetMap live validation still open)
- [x] Tauri multi-installer matrix documented (Win/macOS/Linux)

## B. Pull requests (status checked 2026-10-18)

- [x] **PR #268** — HEC-HMS → HEC-RAS reproducible workflow contracts — merged. The workflow remains a NOT_APPROVED pilot template; merge does not install HEC solvers or authorize a production run.
- [x] **PR #273** — repository secret scanning and audit-applicability documentation — merged after Secret Scanning, Parse Gate, full CI, CodeQL, headed visual E2E, and production-console verification passed on the PR head. Main-push workflows and actual deployment remain separately verified gates.

## C. Host-only (cannot be finished in cloud sandbox / Linux CI alone)

| Gate | Requirement | Status |
|------|-------------|--------|
| **Unreal Engine 5.8 native** | Windows host, UE 5.8, VS 2022, Cesium for Unreal; compile `tsm-native`; stage TSMData; package; Inno Setup | **Scaffold only** — plugins are headers; no CI UE binary |
| **Blender pipeline** | Not in repo | **Out of scope / not started** |
| **Hourini** | No subsystem under that name | **N/A** |
| **Continuous live 4D** | Explicitly not claimed | **Scenario-only labels** |
| **CityGML LOD4 interiors** | Explicitly not claimed | **Non-goal** |
| **HEC-RAS/HMS production run** | Approved pilot AOI + licensed solvers + calibration | **Contract only** until AOI approved |
| **Production API health** | Deployed HTTPS API + `/ready` | **Not claimed by Pages alone** |
| **NOAA GetMap runtime proof** | Live image bytes for Tri-State BBOX | **Pending** |
| **Desktop signing** | Windows cert / Apple notarization secrets | **Operator secrets** |

## D. Operator steps to “finish” each plane

### 1. Public web (primary)

```bash
git pull origin main
# Confirm Actions → Deploy Pages is green for tip of main
# Open https://atphobia22.github.io/Tri-State-Systems-Manager/twin/
# Smoke: Fetch all local water levels; Local Dams ON; GEOID playground Convert
```

### 2. Tauri desktop (Windows x64)

```bash
cd tsm-console
npm ci
npm run build
npm run desktop:build:windows
# Collect NSIS/MSI + SHA256SUMS from CI artifact TSM Desktop
```

See [MULTI-INSTALLER-MATRIX.md](../MULTI-INSTALLER-MATRIX.md) and [WINDOWS-11-OFFLINE-DESKTOP.md](../WINDOWS-11-OFFLINE-DESKTOP.md).

### 3. Unreal native (optional high-fidelity)

On a **Windows 11** machine with **UE 5.8** installed:

1. Open `tsm-native/TSMNative.uproject`
2. Enable Cesium for Unreal per [unreal-cesium-integration.md](../unreal-cesium-integration.md)
3. Point tileset URL at Pages `3d-tiles/.../tileset.json`
4. Run `scripts/native/stage-native-data-root.mjs` for offline TSMData
5. Package Windows target → `dist/tsm-native/Windows/`
6. Build Inno Setup from `TSM-Native.iss`

Until those steps succeed on a licensed host, Unreal is **not** a finished deliverable.

### 4. Hydraulics

1. Approve a written pilot AOI (do not invent a reach)
2. Qualify inputs (URI, time, CRS, datum, hashes)
3. Use the merged PR #268 workflow contracts and validate the generated manifest
4. Run licensed HEC tools; mark outputs COMPLETED_UNVALIDATED until independent validation
5. Human sign-off before any regulatory-adjacent use

## E. Explicit non-goals

- Auto LOMA/grant filing
- Inventing gage-zero / WSE / pool elevations
- Treating Terrain-RGB or 3DEP as FIRM/survey authority
- Promoting Quantum or HEC outputs without classical comparison + human review
- Claiming certified Level-5 / LOD4 / continuous live 4D

**Human authority remains final.**
