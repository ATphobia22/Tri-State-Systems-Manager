# TSM authoritative engineering acceptance protocol — 2026-10-25

**Purpose:** Turn Tri-State Systems Manager into a reliable **daily-use evidence workspace** for engineering, geospatial, hydrology and floodplain professionals, with transparent uncertainty, responsible human authority, and reproducible results. This is a **quality assurance protocol**, not a sealed survey, PE opinion, FEMA approval, or permit.

## Status by domain

| Domain | Verified existing evidence | Technical acceptance still needed | Current authority class |
|---|---|---|---|
| Posey terrain | Source-labeled USGS 3DEP imagery/elevation; datum contracts; partial real DEM geometry trial | Independent survey control, geographic distribution and 2024 ASPRS positional accuracy assessment; item-specific CRS, NAVD88, vertical units, epoch, source integrity | DERIVED / SCREENING |
| County adaptive mesh | 400 km² real 3DEP multi-tile transition-face benchmark (0 two-sided cracks across 17,162 seam checks; seven one-sided/no-data mismatches) | Full official AOI polygon and complete tile coverage, complete balanced adaptive-octree extraction, six directional neighbor continuity, structural manifold/edge QA, no unclassified nodata seams, device repeatability | RESEARCH / PARTIAL |
| FEMA and Indiana floodway | Programmatic model/manifest validators, official flood hazard maps and source registry | Effective/FIS & local regulatory context; four model conditions; same datum, river-station alignment and profile differences; official FARA where applicable; licensed reviewer and actual agency/local process | INFORMATIONAL / HUMAN REVIEW REQUIRED |
| Windows UE5.8 | Native project/source/contract CI and **separate** Tauri Windows offline runtime | Self-hosted UE5.8 Windows Shipping BuildCookRun, clean-device 100% offline install/launch, signing/attestations, performance and calibrated scene acceptance | SOURCE/CONTRACT VERIFIED, NATIVE SHIPPING NOT VERIFIED |
| Building layer | Archived 23,082 IGIO-labeled source hash; published 22,815 screening structures; 267-OBJECTID deterministic difference in data/buildings/POSEY-ARCHIVED-IGIO-IDENTITY-DELTA-2026-10-25.json | Investigate each missing ID and lineage/vintage, repair without invented heights, rerun strict source ID + elevation + roof LOD + mesh validation | DERIVED / PARTIAL |

See `docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md` for measured current gaps and `docs/architecture/TECHNICAL-RELEASE-GATES.md` for the installed TSM authority boundaries.

## Gate A — independent terrain and geodetic evidence

1. Acquire source **LAS/LAZ + classified ground returns, bare-earth DEMs, breaklines, spatial metadata, point density/coverage and official acquisition receipts**. Preserve source item URI/vintage, license, immutable bytes SHA-256 and bbox. Government data is a starting reference, not in itself a legal survey.
2. Require explicit compatible **horizontal CRS, vertical datum, units, coordinate epoch and geoid model** for each measured output. Geoid relation `H = h − N` uses compatible NAD83 frame/epoch and a genuine installed GEOID18 grid where appropriate. **No VDatum/GEOID conversion by treating EGM2008 as GEOID18 or using a statewide constant.**
3. Commission or import **independent field checkpoint measurements** with control monuments, calibration reports, survey network/geodetic tie, checkpoint positioning uncertainties, collection date and signed source report. Under USGS LBS 2025 rev. A / ASPRS (2024), 30 is only a **minimum quantity**, not proof of sufficient spatial/land-cover distribution. Verify actual accepted number by area and landscape.
4. Analyze **nonvegetated and vegetated** checkpoints for lidar source and DEM separately; include survey uncertainty, outliers and open-source calculations. For QL0 nonvegetated RMSEᵥ reference ≤0.05 m; QL1/QL2 ≤0.10 m; QL3 ≤0.20 m per USGS LBS tables. These are **quality-level reference thresholds**, not a guarantee of project design tolerances. Hydrologic model and construction survey demands may be stricter.
5. Keep signed survey report or authenticated source receipt, datum/epoch transform evidence, uncertainty budget and licensed acceptance **outside the application’s automatic authority plane**. A green algorithm may only yield `TECHNICAL_EVIDENCE_READY_FOR_HUMAN_REVIEW`.

USGS authoritative technical sources:
- https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-online
- https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-tables
- https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-data-processing-and-handling-requirements
- https://www.vdatum.noaa.gov/

## Gate B — real county-wide crack-free mesh, not a partial strip benchmark

1. Adopt an official **Posey County boundary polygon and buffered AOI**, with exact coverage measured by spatial intersection, not a rounded 1,087 km² estimate. Resolve every DEM tile intersection and nodata margin, and preserve input tile hashes and overlap source priority.
2. Construct a **balanced 2:1 adaptive octree** and extract the entire terrain mesh, not transition-face strips only. Generate equal-source-sample interfaces and all **six neighbor orientations** (`±x, ±y, ±z`); run seam comparison across **intra-chunk and inter-chunk boundaries** including all LOD transitions.
3. Run deterministic source-sampled geometric tests: intersection seam keys, no two-sided gaps, topological edge incidence and nonmanifold edge counts, explicit boundary classification (natural outer terrain boundary is not incorrectly labeled a crack), winding/orientation and degenerate triangles. Unknown/no-data gap margins remain visibly **UNAVAILABLE** and cannot be silently bridged with fabricated elevations.
4. Validate **repeat-run binary SHA-256**, chunk reproducibility, peak memory, latency, CPU/GPU hardware profile and all source metadata. Publish the full county run report and individual tile/building manifests as CI/release artifacts.
5. Acceptance requires **measured area closure, zero unexplained internal seams** (with a reviewed numeric tolerance/uncertainty policy), all six directions, independent reviewer and source-aligned mesh. A 400 km² 20 m pilot remains **partial** even when all its measured seam comparisons are clean.

The existing measured report:
`docs/validation/transvoxel-county-run/run-report-2026-10-23.json`.
It explicitly records partial AOI, strips-only geometry and nodata exceptions; the authoritative gate shall **reject it as county-complete**.

### Independent triangle-interface seam checker

A measured mesh run can supply actual adjacent chunk triangle coordinates to
`scripts/geospatial/verify_mesh_seams.py`. The checker intersects triangles
with the shared plane and tests **segment coverage** in both directions, so a
coarse straight interface split into multiple fine straight edges is accepted,
while a missing segment, unmatched line, NaN vertex, malformed face or
non-zero open crack is reported. Example (the input **must** contain real
geometric evidence from both neighboring meshes):

```bash
python -m unittest scripts.geospatial.test_verify_mesh_seams -v
python scripts/geospatial/verify_mesh_seams.py \
  --input /path/to/verified-chunk-interface-pairs.json \
  --output /path/to/seam-geometry-audit.json \
  --require-all-six --require-match
```

Input format is JSON object with `toleranceM` (0–0.02) and `interfaces`
array; each interface has a unique `id`, a signed `direction`
(`+x/-x/+y/-y/+z/-z`), `planeCoordinateM`, and `left/right` mesh
objects containing `vertices: [[x,y,z],...]` in meters and
`triangles: [[i,j,k],...]` indices. **No credentials, software approval or
surveys** are embedded in this test fixture. Its output is
`tsm.geometric-seam-audit.v1` with input hash, verified directions,
matched pairs and failures. The full-county readiness gate requires the
`seamAudit` record and the mesh/run report to agree in SHA-256, seam count,
source-tile hashes and coverage metadata.

**Limits:** A triangle-intersection test covers supplied interfaces only; it
does not establish that every chunk of the county was supplied. Small errors
within the configured tolerance are not proof of surveyed coordinates, and
coplanar overlap, highly curved edges or complex nonmanifold geometry may
require further topology checks. The run must also verify the exact official
county polygon and DEM data completeness.

## Gate C — evidence-ready floodway modeling and regulatory packages

1. Resolve the local floodplain administrator, study/FIRM panel effective dates, official Flood Insurance Study, regulatory floodway polygon and **Indiana FARA** where required. A parcel coordinate alone does **not** establish an approved hydrologic AOI or determine FEMA status.
2. Preserve separate **effective, duplicate-effective, corrected-effective (when relevant), existing/pre-project as warranted, proposed, and as-built** model stages, with independently hashed HEC-RAS inputs and outputs, solver build, discharge/boundary conditions, geometry, roughness, hydraulic structure and calibration evidence.
3. Compare matched stream/cross-section/station profiles with consistent river station, coordinate reference and NAVD88 elevation and **explicit uncertainty/precision rules**. Never silently interpret stage feet as WSE feet, infer USGS station zero, or claim `Number(null) === 0` as an observation.
4. Federal adopted floodway encroachments under **44 CFR 60.3(d)(3)** must demonstrate **no increase in water surface elevation** or follow the applicable CLOMR/LOMR process. Indiana DNR says FEMA no-rise demonstration of `0.00 ft` or appropriate CLOMR is required; its **different** cumulative state floodway surcharge framework must not be substituted as permission under FEMA. Do not convert `0.14` or `0.15` into a universal no-rise tolerance.
5. The technical gate produces a **review packet only**: cited sources, signed professional analysis/topographic certification as applicable, limitations and explicit regulatory reviewer/approval record outside TSM. Only authorized human officials make regulatory determinations. Do not automate a LOMA, LOMR, No-Rise Certificate or permit.

Official source texts:
- https://www.ecfr.gov/current/title-44/chapter-I/subchapter-B/part-60/section-60.3
- https://secure.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/no-rise
- https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal/
- https://www.law.cornell.edu/cfr/text/44/65.7
- https://www.fema.gov/sites/default/files/documents/fema_mt-2-requests-guidance_122020.pdf

## Automated evidence readiness — installed commands

Run against explicit local data (no web downloads, no hidden telemetry, no automatic authority):

```bash
python -m unittest scripts.engineering.test_validate_authority_readiness -v
python scripts/engineering/validate_authority_readiness.py \
  --input data/engineering/authority-readiness/posey-terrain-evidence.json \
  --root . --output /tmp/tsm-terrain-readiness.json
python scripts/engineering/validate_authority_readiness.py \
  --input data/engineering/authority-readiness/posey-county-mesh-evidence.json \
  --root . --output /tmp/tsm-county-mesh-readiness.json
python scripts/engineering/validate_authority_readiness.py \
  --input data/engineering/authority-readiness/posey-floodway-evidence.json \
  --root . --output /tmp/tsm-floodway-readiness.json
```

To **require** complete metadata/readiness for a separate release job, add `--require-ready`. An incomplete project status returns nonzero, never fabricated PASS. Even a structurally complete packet remains *ready for independent professional review*, **not certified**; source claim authenticity and model accuracy must be checked externally.

CI: `.github/workflows/authority-evidence-readiness.yml` runs synthetic validations, records the actual three Posey gap reports, and checks that each remains explicitly `INCOMPLETE` and never `approved=true`.

## Daily professional UX and operational safeguards

- Display live/stale/unavailable **source timestamps**, confidence and measured datum/unit/epoch next to each elevation and flood map; publish a one-click evidence bill of materials and immutable source URLs for every derivation.
- Separate **observations, model simulations, forecasts, screening layers and regulatory effective FIRM** in both 2D/3D/4D renderers. Scenario animations are never reported as a live levee failure or official flood warning.
- Provide full accessibility, anonymous public viewing, offline-first read access and no mandatory personal accounts for community users. Privileged reviewers sign in for attributable approvals and private case materials.
- For a public technical demonstration, publish **machine-verifiable test data and representative synthetic scenes**, not site-specific residential evidence by default. Public AOI disclosure requires owner review; prior publicly committed identifiers may remain in Git history.
- A green software pipeline proves **software tests**, not geodetic survey accuracy, flood model calibration, structural stability, FEMA approval or clean-device UE5.8 Shipping installation.
