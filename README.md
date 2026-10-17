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
- **Scenario Studio:** Human-triggered cascade screening (event × adaptation → residual risk index and map pins). Labeled **SCENARIO / SIMULATION_DEMO** only—not SFHA, not a warning system, not a regulatory product.
- **Engineering and provenance contracts:** Geospatial transformations, deterministic screening models, hashes, schema checks, and human-review gates. A visualization or model output is not itself an engineering approval.
- **Web and offline delivery:** Vite console on GitHub Pages; Tauri multi-installers for desktop; optional Unreal native plane is scaffold-only until built on a licensed Windows host.

### Visualization scope and maturity

TSM is an **evidence-governed digital shadow + scenario workspace**. It does **not** claim certified Level-5 twin autonomy, CityGML LOD4 interiors, or continuous live 4D as a product default. See [flood twin architecture](docs/architecture/FLOOD-TWIN-ARCHITECTURE-v1.0.md) and [maturity scorecard](docs/architecture/TSM-MATURITY-SCORECARD-2026-10-17.md).

## System status — 2026-10-17

### Twin Canvas (Scopes B + C + Scenario Studio)

- **Vertical context HUD** with explicit **Fetch live water level** (button-only; no auto-poll).
- **Multi-station constellation:** USGS 03378500 (New Harmony), 03322000 (Evansville), 03322420 (Uniontown / Myers context).
- **Local dams:** Posey NID entries + John T. Myers L&D with **official NID API coordinates** (not approximate placeholders).
- **Scenario Studio:** human-triggered cascade screening (event × adaptation → residual risk + map pins). Authority **SCENARIO / SIMULATION_DEMO** only — not SFHA, not a warning system.
- **GEOID18 educational playground** (DERIVED AOI samples) + [bias vs tilt docs](docs/geodesy/GEOID18-BIAS-VS-TILT.md).
- Architecture: [flood twin](docs/architecture/FLOOD-TWIN-ARCHITECTURE-v1.0.md) · [maturity scorecard](docs/architecture/TSM-MATURITY-SCORECARD-2026-10-17.md).
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
- [Candidate Posey parcel AOI evidence (not approved; watershed not delineated)](data/posey-county/evidence/13101-bonebank-road-site-aoi-v1.json)
- [Candidate DEM provenance and one-point cross-check limitations](data/posey-county/elevation/bonebank-anchor-dem-10m.provenance.json)
- [Release gates 2026-10-15](docs/release/RELEASE-GATES-2026-10-15.md)

## Geospatial source acquisition and data fabrics

The acquisition status of Overture vector context, Indiana LiDAR/DEM products, FEMA NFHL, and regional NOAA LiDAR is documented in [source access and acquisition notes](docs/fabrics/OVERTURE-INDIANA-LIDAR-FEMA-ACCESS-2026-10-17.md). The notes distinguish installed tools, portal discovery pages, live REST endpoints, downloaded files, and datasets that are out-of-area or access-controlled. Large global or regional products are not mirrored wholesale into standard Git.

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
