# TSM current system status and finish plan — 2026-11-10

**HEAD (at write time):** track `main` (recent tip includes UE Shipping request `88751bb` and prior native/Drive/PBR work).  
**Public console:** https://atphobia22.github.io/Tri-State-Systems-Manager/  
**Policy:** Technology informs people; human authority remains final.

---

## 1. What you have already built (major planes)

### Web / console (working program surface)
- React Router digital twin, MapLibre maps, TwinCanvas / 3D paths
- Live stage on explicit user fetch; gage-zero unpublished by default
- NFHL fabric, AOI coverage panel, LOMA package docs and checklists
- Geodesy: NCAT/VDatum clients, CRS/provenance reports, freeboard toolkit
- Hydro toolchain registries: HEC-RAS bridges, SWMM/Landlab/FloPy, twin stack (Cesium/Ditto/PyGMT/3dfier/HydroPol2D/DTDL)
- Evidence/Merkle patterns, authority badges, simulation vs observation labels
- GitHub Pages SPA deploy path

### Native / Unreal (active finish front — Nov 10 commits)
- UE5.8 Windows Shipping one-shot CI path and map generation
- World Partition startup map generation on runner
- Portable tileset path within staged TSMData
- Drive restore of large private inputs + strict manifest verification
- Signed artifact / SBOM / optional Drive publish
- Evidence-gated HUD (no unsourced 100-year demo claims)
- PBR material bake integrity (PR #533)

### CI (observed near tip)
- Tri-State Systems Manager CI Pipeline — **success**
- CodeQL — **success**
- PTDT v35 E2E — **success**
- TSM Native — **queued** at last check (watch Actions for cook/shipping outcome)

### Repo hygiene
- Open PRs: **none**
- Extra branch: `dependabot/github_actions/github-actions-6d566a10c4` (no open PR listed)

---

## 2. Remaining work (honest partition)

### A. Can finish in software / CI (continue now)

| Priority | Item | Done when |
|----------|------|-----------|
| P0 | **TSM Native / UE Shipping run** completes with signed artifacts | Actions green + installer hash recorded |
| P0 | **Drive input data gate** satisfied (private TSMData snapshot present + checksums) | Strict manifest PASS on runner |
| P1 | **Geodetic blockers** called out in release docs fully resolved or explicitly BLOCKED with owner | Doc + CI gate agree |
| P1 | **Cesium path** from PARTIAL → usable tileset URL in twin route | Viewer loads self-hosted or Ion tiles |
| P1 | **Console production smoke** on Pages after each main push | Manual or workflow URL check |
| P2 | **Optional Python bridges** (ras-commander, pyswmm, landlab, flopy, pygmt) installed on operator host | `probe` scripts return installed:true |
| P2 | Dependabot Actions branch merged or deleted | Only `main` remains |
| P3 | ArcGIS Online **Scenes** as optional presentation reference (not authority) | Doc + optional scene URL config |

### B. Human / external only (cannot be finished by code alone)

| Item | Clock / note |
|------|----------------|
| **LOMA 26-05-2022A Layer-2** deed/plat, tax map, PE/EC, MSC PDF, send email | Target **2026-12-21** |
| Production IdP secrets / signing keys | Operator vault |
| HEC-RAS binary + Windows COM runs | Operator workstation |
| PE-sealed elevations and FEMA determination | Licensed professional + FEMA |

### C. Explicit non-goals (do not “finish” by inventing)

- Auto-LOMA filing
- Treating 3DEP/EPQS as certified LAG/BFE
- Publishing gage→NAVD88 without product-matched evidence
- Claiming UE cinematic acceptance without runner evidence

---

## 3. Recommended sequence (next 7 days)

1. **Watch** [TSM Native](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions) for the Shipping one-shot; capture logs if BLOCKED on Drive/geodetic data.  
2. **Ensure** private Drive snapshot + rclone secrets match `docs/DRIVE-MANIFEST.md` / release handoff commits.  
3. **LOMA parallel track:** MSC FIRMette PDF hash + A1–A3 collection (see `docs/regulatory/loma/`).  
4. **Console:** keep main CI green; smoke Pages.  
5. **Optional:** install hydro Python tools on your machine; run probe bridges.  
6. **Cleanup:** delete merged dependabot branch when idle.

---

## 4. Definition of “full working program”

| Plane | Working means |
|-------|----------------|
| Web twin | Pages loads; map/twin; live stage on demand; labels honest |
| API / evidence | Deployed API with human-gated evidence write |
| Native UE | Shipping installer builds from verified TSMData; offline map boots |
| Regulatory support | Package ready; humans submit LOMA |
| Hydro models | External RAS/SWMM/etc. via bridges; results imported as MODEL_SIMULATION |

Not one binary — **four coordinated planes** under human authority.

---

## 5. Capability control plane reminder

Gated capabilities (examples): `fema-loma`, `nfip-layer2`, `elevation-datum`, `hec-ras-2d`, `evidence-ledger` acceptance — require human/professional gates per `integrations/registry/tsm-capability-control-plane.json`.

**Human authority remains final.**
