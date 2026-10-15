# Tri-State Systems Manager (TSM)

**An evidence-governed geospatial and engineering decision-support platform for the Ohio–Wabash tri-state region.**

TSM brings public hydrology, terrain, imagery, flood-hazard information, infrastructure context, engineering models, and provenance into a reviewable workspace for communities, public agencies, and qualified engineering teams. Its web console combines interactive mapping with source-aware 3D visualization; its data and model pipelines preserve source identity, dates, coordinate reference systems, vertical datums, uncertainty, and review status from acquisition through publication.

TSM is decision-support software—not a surveying instrument, certified digital-twin product, licensed engineering service, regulatory determination, emergency warning system, or substitute for agency and professional review. A layer appearing in a visualization does not make it survey-grade or authoritative for a different purpose. Missing, stale, provisional, derived, historical, simulated, and unavailable inputs are meant to remain distinguishable rather than be silently filled with invented facts.

> **Operating principle:** Technology informs people; it does not silently govern people. Qualified human and agency authority remains final.

## Interactive web surfaces

Production console routes (when the corresponding Pages build has completed successfully):

- [Public console (SPA)](https://atphobia22.github.io/Tri-State-Systems-Manager/)
- [Self-hosted 3D terrain viewer](https://atphobia22.github.io/Tri-State-Systems-Manager/terrain-3d/)
- [Platform capabilities index](https://atphobia22.github.io/Tri-State-Systems-Manager/platform/)
- [Twin Canvas](https://atphobia22.github.io/Tri-State-Systems-Manager/twin/)

Missing assets produce visible errors rather than suppressing the console. Visualization availability does not relax provenance, datum, engineering, or regulatory evidence requirements.

## Product overview

- **Public-source geospatial workspace:** MapLibre maps combine state and federal imagery, elevation, flood, parcel, road, building-footprint, and land-survey context, with source attribution and explicit layer controls.
- **Evidence-aware 3D visualization:** MapLibre terrain/hillshade, source-derived building/terrain tiles when available, and camera navigation. Availability depends on published, validated tile assets.
- **Hydrology and flood context:** USGS observations and NOAA/NWS products with timestamps, qualifiers, freshness, and station/datum constraints. FEMA effective products, Indiana best-available flood mapping, levee information, planning material, and model scenarios remain separate authority classes.
- **Engineering and provenance contracts:** Geospatial transformations, deterministic screening models, hashes, schema checks, and human-review gates. A visualization or model output is not itself an engineering approval.
- **Web and offline delivery:** Vite console on GitHub Pages; Tauri multi-installers for desktop; optional Unreal native plane is scaffold-only until built on a licensed Windows host.

### Visualization scope and maturity

Source-aware regional/community visualization and engineering-review workspace—not a certified “Level 5” digital twin. **CityGML LOD4 interiors, continuous live 4D synchronization, and certified Level-5 twin conformance are not claimed.** Simulations and time-lapse presentation are labeled as scenarios or derived visualization, not live observations.

## Current production status (2026-10-15)

**Deployment model:** GitHub Pages hosts the static Vite SPA. Desktop packaging uses Tauri (primary). Unreal Engine native is an optional high-fidelity plane and is **not** a finished CI binary.

| Surface | Location |
|---------|----------|
| **Primary branch** | `main` |
| **Public console** | https://atphobia22.github.io/Tri-State-Systems-Manager/ |
| **Twin Canvas** | https://atphobia22.github.io/Tri-State-Systems-Manager/twin/ |
| **Windows desktop (Tauri)** | NSIS/MSI via `tsm-console` `desktop:build:windows` / TSM Desktop workflow |
| **Unreal native** | Scaffold — requires local UE 5.8 (see `tsm-native/`) |
| **API readiness** | `GET /ready` when an authorized API deployment is configured |
| **Finish register** | [REPO-FINISH-CHECKLIST-2026-10-15.md](docs/architecture/REPO-FINISH-CHECKLIST-2026-10-15.md) |

Settings → Pages → Source must be **GitHub Actions**.

## System status — 2026-10-15

### Twin Canvas (Scopes B + C)

- **Vertical context HUD** with explicit **Fetch live water level** (button-only; no auto-poll).
- **Multi-station constellation:** USGS 03378500 (New Harmony), 03322000 (Evansville), 03322420 (Uniontown / Myers context).
- **Local dams:** Posey NID entries + John T. Myers L&D with **official NID API coordinates** (not approximate placeholders).
- **GEOID18 educational playground** (DERIVED AOI samples) + [bias vs tilt docs](docs/geodesy/GEOID18-BIAS-VS-TILT.md).
- WSE NAVD88 remains **blocked** until a published station conversion is validated (fail-closed).

### CI, Pages, and security

- Pages path realigned to committed 3D assets; CodeQL core fixes + FarmVibes paths-ignore.
- Merged: IBM Quantum DERIVED/quarantine; evidence-first flood contracts; geospatial acceptance chain.

### 3D assets on main

- Buildings GeoJSON + GLB 3D Tiles 1.1 (DERIVED). Terrain-RGB / hillshade for visualization only.

### Explicitly not finished here

- Unreal 5.8 packaged operator app (host-only).
- Continuous live 4D; LOD4 interiors; Blender pipeline (not in repo).
- Production HEC-RAS/HMS run for an approved pilot AOI.
- Live NOAA GetMap image proof; production API health claim.

See [release-gate register](docs/release/RELEASE-GATES-2026-10-15.md).

## Hydrology and hydraulic release status

Screening primitives and contracts exist. Production hydraulic conclusions remain gated on an approved pilot AOI, qualified inputs, verified datums, reproducible solver artifacts, independent validation, and qualified review.

- [Hydrology release contract](docs/hydrology/HYDROLOGY-RELEASE-CONTRACT.md)
- [USACE HEC integration plan](docs/hydrology/USACE-HEC-SOFTWARE-INTEGRATION.md)
- [Reproducible HEC-HMS → HEC-RAS workflow](docs/hydrology/HEC-HMS-RAS-REPRODUCIBLE-WORKFLOW.md)
- [Candidate AOI evidence: 13101 Bonebank Road](data/posey-county/evidence/13101-bonebank-road-site-aoi-v1.json)
- [Candidate-only run manifest (v2; intentionally blocked)](data/posey-county/hec/13101-bonebank-road-candidate-run-manifest-v2.json)
- [HEC coupled-run manifest v2 schema](data/schemas/hec-coupled-run-manifest-v2.schema.json)
- [Release gates 2026-10-15](docs/release/RELEASE-GATES-2026-10-15.md)

## Architecture principles

1. **Human authority is non-negotiable** (ADR-004 / ADR-006 S1 default).
2. **Evidence plane is fail-closed** — hashes, schemas, reviewer identity for `human_authorized`.
3. **Authority classes stay separate** — OBSERVED ≠ DERIVED ≠ SCENARIO ≠ REGULATORY.
4. **Open source (Apache-2.0)** with contribution governance.
5. **Zero-trust multi-tenant** readiness for production IdP (OIDC).

## Quick start (console)

```bash
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager.git
cd Tri-State-Systems-Manager
npm install
npm run dev --workspace=tsm-console
```

Desktop / offline: [WINDOWS-11-OFFLINE-DESKTOP.md](docs/WINDOWS-11-OFFLINE-DESKTOP.md) and [MULTI-INSTALLER-MATRIX.md](docs/MULTI-INSTALLER-MATRIX.md).

## License

Apache-2.0 — see [LICENSE](LICENSE).

## Disclaimer

TSM is public-interest decision-support software. It does not replace licensed survey, engineering, or regulatory determinations. Always verify critical elevations and flood determinations against official FEMA/IDNR/USACE products and qualified professionals.
