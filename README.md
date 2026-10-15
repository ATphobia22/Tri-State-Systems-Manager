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
- **Web and offline delivery:** Vite console on GitHub Pages; separate workflows build native/offline artifacts. Runtime/API capabilities require their own deployments and are not implied by the static site.

### Visualization scope and maturity

Source-aware regional/community visualization and engineering-review workspace—not a certified “Level 5” digital twin. **CityGML LOD4 interiors, continuous live 4D synchronization, and certified Level-5 twin conformance are not claimed.** Simulations and time-lapse presentation are labeled as scenarios or derived visualization, not live observations.

## Current production status (2026-10-14)

**Deployment model:** GitHub Pages hosts the static Vite SPA. Windows x64 native runtime is distributed as a verified offline bundle. Browser/API surfaces remain independently deployable.

| Surface | Location |
|---------|----------|
| **Primary branch** | `main` |
| **Public console** | https://atphobia22.github.io/Tri-State-Systems-Manager/ |
| **Windows x64 offline runtime** | GitHub Actions artifact `TSM-OFFLINE-RUNTIME-WINDOWS-X64-<commit>` |
| **API readiness** | `GET /ready` when an authorized API deployment is configured |
| **Console package** | `tsm-console` (React 19, Vite 8, MapLibre 6.x, deck.gl scoped modules, Three.js) |

Settings → Pages → Source must be **GitHub Actions**. The workflow does not fabricate or bypass that repository-level setting. Pages can publish the static console without a backend; when an API is configured, `VITE_TSM_API_BASE_URL` must be an HTTPS origin.

## System status — 2026-10-14

### CI, Pages, and security

- **GitHub Pages deploy green** on `main` after gate realignment to committed 3D assets (`buildings-3d.json` with `height_m`, tileset 1.1, terrain-3dep) and removal of stale SHA256SUMS/Cesium-only checks.
- **Merged:** PR #266 IBM Quantum Compute integration; PR #265 evidence-first flood twin vertical-slice contracts; PR #264 geospatial acceptance chain and graceful degradation.
- **CodeQL re-enabled** with `paths-ignore` for vendored `tools/agriculture/farmvibes-ai/**`. Core fixes: IDNR wells log-injection sanitize; anchored host assertions in map-plane and native provenance tests.
- **Posey offline acquisition:** mandatory BAFM + parcels hard-fail (no soft-outage); path filters so unrelated main pushes do not re-run the long Windows job.

### 3D assets on main

- **22,815** buildings GeoJSON with `height_m` and `achievedLod` (LOD1/LOD2 from research-validated roof-plane pipeline; no fabricated geometry).
- **4,121** GLB 3D Tiles 1.1 tileset with `extras.tsm.sourceObjectId`, `authorityClass=DERIVED`, validators green.
- Terrain-RGB / hillshade layers for MapLibre visualization; production contract remains DERIVED / non-regulatory unless independently certified.

### IBM Quantum (opt-in, server-side only)

- Bounded **IBM Quantum Compute Service REST** client + worker (`integrations/quantum/`).
- Contracts locked to `authorityClass: DERIVED`, `outputPolicy: quarantine`, primitive `sampler` only, API version `2026-04-15`.
- Results never auto-promote to Solver Result v1; classical comparison and human review required.
- Docs: [`docs/integrations/ibm-quantum-compute.md`](docs/integrations/ibm-quantum-compute.md) — aligned with [IBM Quantum API index](https://quantum.cloud.ibm.com/docs/en/api), Compute Service REST, IAM, Resource Controller, and [Catalog Management API](https://cloud.ibm.com/docs/apis/resource-catalog/private-catalog).
- Secrets: `IBM_QUANTUM_API_KEY` + `IBM_QUANTUM_INSTANCE_CRN` only (never Vite/browser).

### Earlier closed gates (summary)

- **GEOID18:** official NGS grid integrated; fail-closed sampler; Bonebank anchor uses real bilinear N (not regional constant).
- **USGS:** live paths on Water Data OGC API (`api.waterdata.usgs.gov`); button-only telemetry; no auto-poll on load.
- **Building heights:** observed LiDAR subset + DERIVED COPC path with hard reject rules; never synthetic fill.
- **4D temporal engine:** SIMULATED / SCENARIO labeled only.

## Hydrology and hydraulic release status

TSM includes source-aware hydrology ingestion contracts and a lumped SCS Curve Number rainfall-runoff screening primitive. These are not, by themselves, a validated flood forecast or hydraulic model. Production hydraulic conclusions remain gated on an approved pilot AOI, qualified rainfall/gage/terrain/bathymetry inputs, verified datum conversions, reproducible solver artifacts, independent calibration and validation, uncertainty analysis, qualified review, and deployment verification.

The NOAA/NWS CloudGIS context integration is merged, but live GetMap image validation remains pending. Radar reflectivity is not rainfall accumulation; warning overlays are not inundation boundaries; and raw gage stage must not be compared directly with NAVD88 elevations.

- [Hydrology and hydraulics release contract](docs/hydrology/HYDROLOGY-RELEASE-CONTRACT.md)
- [USACE HEC software integration plan](docs/hydrology/USACE-HEC-SOFTWARE-INTEGRATION.md)
- [Coupled HEC-HMS → HEC-RAS manifest schema](data/schemas/hec-coupled-run-manifest-v1.schema.json)
- [HEC manifest validator](scripts/hydrology/validate-hec-run-manifest.mjs) and [shell-free workflow runner](scripts/hydrology/run-hec-coupled-workflow.mjs) — execution requires an approved AOI and verified input hashes.
- [Current release-gate register](docs/release/RELEASE-GATES-2026-10-15.md)
- [Engineering evidence pipeline](docs/ENGINEERING-EVIDENCE-PIPELINE.md)
- [NOAA/NWS CloudGIS integration contract](docs/data-sources/NOAA-CLOUDGIS-INTEGRATION.md)

## Architecture principles

1. **Human authority is non-negotiable** (ADR-004 / ADR-006 S1 default).
2. **Evidence plane is fail-closed** — hashes, schemas, reviewer identity for `human_authorized`.
3. **Authority classes stay separate** — OBSERVED ≠ DERIVED ≠ SCENARIO ≠ REGULATORY.
4. **Open source (Apache-2.0)** with contribution governance.
5. **Zero-trust multi-tenant** readiness for production IdP (OIDC).

See `ARCHITECTURE.md`, `COMPLIANCE.md`, `SECURITY.md`, and `docs/` for ADRs, NIST AI RMF mapping, and operational runbooks.

## Quick start (console)

```bash
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager.git
cd Tri-State-Systems-Manager
npm install
npm run dev --workspace=tsm-console
```

Production build and offline Windows paths: see `docs/WINDOWS-11-OFFLINE-DESKTOP.md` and `MULTI-INSTALLER-MATRIX` docs in-repo.

## License

Apache-2.0 — see [LICENSE](LICENSE).

## Disclaimer

TSM is public-interest decision-support software. It does not replace licensed survey, engineering, or regulatory determinations. Always verify critical elevations and flood determinations against official FEMA/IDNR/USACE products and qualified professionals.
