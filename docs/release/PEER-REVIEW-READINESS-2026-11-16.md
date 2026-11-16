# Peer-review readiness: TSM release and engineering evidence (November 16, 2026)

**Scope:** Public GitHub Pages/Cesium deployment at [main commit 41b336cd96383a581ab06787429045d21ac92b0d](https://github.com/ATphobia22/Tri-State-Systems-Manager/commit/41b336cd96383a581ab06787429045d21ac92b0d). This is a reproducibility and disclosure packet, **not** evidence of professional certification, independent scientific peer review, survey accuracy or a regulatory decision.

## Confirmed release facts

- [Production run #43786012217](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/43786012217): build and Pages deploy succeeded; browser smoke and sampled public file verification passed.
- Local inventory: **14,007 files** with size and SHA-256, pinned to release commit and workflow run. Receipt at https://atphobia22.github.io/Tri-State-Systems-Manager/cesium-release-receipt.json with .sha256 sidecar. The immutable receipt digest for this run is **58858191f9cb5ccf430cb88c7d4ab93128f6df516c431048f20fcafb9b8fe647**.
- Remote downloaded samples: **7** matching the build digest, result **REMOTE_SAMPLES_MATCH_BUILD**; limitation **NOT_ALL_PUBLISHED_FILES_DOWNLOADED**. This **does not** verify all 14,007 public bytes remotely.
- The deployment inspected **22,815** height-bearing building metadata features, short of the **23,082** footprint target by **267**. Other height-run counts use different gates and cannot prove this target.
- [Receipt/independent-checkpoint CI](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/43786012351) passed synthetic tests. Synthetic input is **not** a measured independent survey.

## Peer-review evidence table

| Discipline | Relevant code / source documents | Independent review required |
|---|---|---|
| Source provenance | [source registry](../../data/tsm-fgdc-tristate-geospatial-registry-v1.json), [catalog](../DATA-SOURCE-CATALOG.md), [government adapters](../../packages/government/) | Specific agency/service/product, effective/acquisition date, access/license, source checksum, collection bounds and source quality |
| Geodesy | [Datums](../geodesy/DATUMS.md) and [elevation manifests](../../data-sources/manifests/) | Horizontal CRS, epoch, EPSG, vertical datum/geoid, units, actual transformation and survey-control uncertainty |
| Terrain and buildings | [Cesium scene builder](../../scripts/geospatial/build_cesium_regional_scene.py) and [Posey building staging](../../scripts/geospatial/stage_cesium_posey_buildings.py) | Missing-height inventory, imagery/LiDAR vintage, ground/roof residuals, bathymetry, full 23,082 reconciliation |
| Runoff and flood | [SCS CN](../../tsm-console/src/lib/hydrology-runoff.ts), [diffusion wave](../../tsm-console/src/lib/hydraulics-diffusion2d.ts) and [prior review](../PEER-REVIEW-PACKAGE.md) | Scenario assumptions, forcing/observations, grid/cell volume, boundaries, stability, calibration, holdout validation, uncertainty |
| Positional accuracy | [checkpoint calculator](../../scripts/geospatial/independent_checkpoint_accuracy.py) and [method](../geodesy/INDEPENDENT-CHECKPOINT-ACCURACY-2026-11-15.md) | REAL independent checkpoints, documented distribution/independence, survey RMSE, hash-pinned source data/operation/report, professionally interpreted result |
| Engineering/regulation | [assurance standard](../architecture/ENGINEERING-ASSURANCE-STANDARD.md), [evidence chain](../ENGINEERING-EVIDENCE-PIPELINE.md) | FEMA effective FIRM/FIS, professional work product, environmental review, agency decision, completed model calibration |
| Native application | [UE5.8 Shipping runbook](UE58-ONE-SHOT-SHIPPING-RUNBOOK-2026-11-10.md), [Windows acceptance](UNREAL-WINDOWS-SHIPPING-ACCEPTANCE.md) | Actual signed/packaged Shipping artifact, TSMData hashes, Windows 11 x64 network-disabled headed launch, graphics/hardware logs, no WebView/localhost dependency |
| Grant matrix | [dated matrix](../grants/47620-Grant-Master-Matrix-2026-10-08.csv), [official funding registry](../grants/OFFICIAL-FUNDING-SOURCE-REGISTRY-2026-10-26.md) | Live NOFO, sponsor eligibility, match, deadline, costs, environmental compliance, award authorization; no automated filings |

## Repeatable methods and scientific boundaries

**Runoff.** The implemented USDA NRCS SCS CN method uses S = 1000/CN - 10 inches, initial abstraction Ia = 0.2 S, and cumulative direct runoff Q = (P-Ia)^2/(P-Ia+S) for rainfall P > Ia; zero below it. This is lumped, event-based runoff, **not** a calibrated/routed river hydrograph.

**Flood screening.** The implemented 2D zero-inertia diffusion wave updates finite-difference water depths using Manning-based face flux and a timestep guard dt <= dx²/(4 Dmax). It is not full Saint-Venant momentum flow, a storm-sewer network, or a regulatory hydraulic model.

**Water levels and datums.** Water-surface elevation (NAVD88) = station-specific observed stage + **verified matching station gage-zero in NAVD88**. A geoid relation h = H + N is meaningful only for compatible horizontal/vertical frames and the stated model. EPSG:2966 uses **US survey feet**, not metres; GEOID12B is not silently GEOID18. FEMA BFE and floor/crest elevations must share datum and units before computing differences.

**Independent checkpoints.** For supplied measured aligned metre-coordinate residuals, RMSE_H1 = sqrt(mean(dx²+dy²)), RMSE_V1 = sqrt(mean(dz²)); final RMSE_H/V additionally include measured checkpoint-survey uncertainty by root-sum-square when separately evidenced. [USGS ASPRS 2024 Edition 2 Version 2 explanation](https://www.usgs.gov/ngp-standards-and-specifications/adopt-updated-accuracy-standards) notes modern minimum 30 checkpoints and abandonment of legacy 95% confidence labeling. No code can prove checkpoint independence or certify a survey; missing reported error components stay **null**.

**Earthwork / BCA.** Only compute signed cut/fill from aligned masks/cell areas and consistent vertical frames; report excavation and placement separately. Funding BCA requires qualified eligible benefits/costs under the **current applicable** program, not model-implied benefits or assumed cost shares.

### Commands from repository root

~~~bash
python3 -m unittest discover -s tests/geospatial -p test_independent_checkpoint_accuracy.py -v
python3 -m unittest discover -s tests/release -p test_cesium_published_receipt.py -v
node scripts/ci/validate-grant-matrix.mjs
~~~

From the console subdirectory:

~~~bash
npm ci
npm run check:type
npm run test:all
npm run build
~~~

See [public receipt instructions](CESIUM-DOWNLOADABLE-RECEIPT-2026-11-15.md) for matching published bytes to an **immutable** run. Running software tests proves tested behaviors, not downstream professional validity.

## Remaining acceptance blockers

1. **Survey:** field-measured independent control, actual data/survey reports, coordinate operation, epochs, distribution, uncertainty and sign-off. No synthetic fixture replaces this.
2. **Buildings:** reconcile **267** missing published height-linked footprint records without adjusting expected target counts.
3. **Geospatial/hydro:** authoritative terrain and river bathymetry, geodetic conversions, event boundary conditions, instrument/calibration/holdout validation, quantified uncertainties.
4. **UE5.8 offline:** independently reproduce packaged and signed Windows 11 native Shipping executable startup under network disconnection and headed cinematic scene inspection with FPS/VRAM/hardware evidence.
5. **Grants:** the October 8 CSV contains outdated “OPEN” statuses after their recorded deadlines. Validate against **current official** notices; no automatic applications, eligibility, awards, or stale-deadline promotions.
6. **Regulatory/engineering:** independent professional/agency determinations cannot be inferred from an attractive scene, map overlay, checksum, API response, or successful CI.

**Disposition labels:** VERIFIED, PENDING, BLOCKED, NOT EVIDENCED. Preserve missing values and explicitly record the source and timestamp for any acceptance decision. **Human authority final.**
