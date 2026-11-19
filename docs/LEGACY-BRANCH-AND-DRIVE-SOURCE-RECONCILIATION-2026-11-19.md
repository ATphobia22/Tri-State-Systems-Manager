# Historical branch reconciliation and Drive-source triage — 2026-11-19

**Scope:** Review six legacy branches against protected main after #679. This document records what was independently compared, what is already integrated, and what MUST NOT be silently overwritten. Tracking issue: #680.

**Verified main baseline:** `c090580a60ae851557e82ca0ffd2f4089e6358d7` (PR #679, TIGER/Line 2024 road labels). This is an inventory snapshot, not a UE5.8 Shipping release attestation.

## GitHub branch disposition

| Branch (snapshot SHA) | Unique/overlapping changes | Resolution |
|---|---|---|
| `feat/geobim-source-evaluation-20261111` (`8f21069768a729332e518d9b32d13f9459be6273`) | The evaluation JSON (`e717bdbc0cc0c174be9e6c06fee59cf7cbe3f61f`) and Node test (`d7f62285f748617af331ab05c4b67646159d836a`) are **exact blob matches** on main. Main has a newer, longer evaluation/IFC preflight document. | **Already integrated/superseded**; no old-file replacement. |
| `feat/geobim-source-evaluation-rebased-20261119` (`abd3b5b26486b0563df0dea2240cce2f364466f8`) | GitHub compare: zero commits ahead of main and no unique files. | **No changes to merge**; cleanup candidate. |
| `feat/igio-four-county-2025-index-20261119` (`42c1bdc66045d2f9244a7507e14280f9b89b88db`) | Prior `.github/workflows/posey-2025-leafon-dsm-acquisition.yml` blob `95d5a56452643118aedf42223d1300cde0ee517c` differs from main `fda6bd6cb6d3fe06abccd2c5724ad106f5ea893a`. Main has since adopted the broader four-county acquisition workflow and source checks. | **Superseded workflow**; never overwrite current CI with the old one. Review individual missing acquisition predicates if discovered. |
| `feat/mount-vernon-scene-layer-runtime-20261111` (`d92b3c3a1620e20bc3e72065daadd1a92b0fe4cd`) | Six of seven compared files are exact blob matches, including both `TSMSceneLayerSubsystem` files, both native scripts and both native docs. The seventh, `TSMEngineeringHUD.cpp`, is substantially more developed on main (38,734 characters vs 15,341 on the branch). | **Already integrated/newer native HUD**; do not revert HUD. Headed Unreal validation still owed. |
| `fix/public-cesium-cinema-reconcile-20261117` (`78408dfa70a1263755f55970fda315267de540ef`) | Old Cesium cinema, region, WebGL controls and tests overlap newer main. `CesiumPhotorealisticView.tsx` matches main exactly. Main has `engineering-renderer-toggle`, `CesiumRegionalTwinView autoFlyover`, map fallback, building toggle, and existing E2E/contract coverage. | **Functionally integrated** at source-contract level; do not merge obsolete viewer copies. Actual headed scene acceptance is independent. |
| `fix/public-views-gauges-memorial-map-controls-20261117` (`f585b6155a86e38285ed8d048046ba7f7986f087`) | Main already has dedicated memorial route, on-demand official USGS reader, collapsed map/flood tools and Cesium buildings shortcut. Old-only Cypress spec `public-map-recovery.cy.ts` refers to retired button labels/DOM; old-only CSS files are not imported on main. Newer main E2E includes memorial, USGS, flood controls, Cesium flyover and buildings. | **Functionally integrated with modernized tests**; re-run headed browser acceptance. Do not add unused CSS or stale Cypress assertions merely to make old histories appear merged. |

**Important:** GitHub `compare` reporting historical branch commits “ahead” does not establish that those branches contain useful changes missing from main. These branches are **not** claimed to have been Git-merged or deleted by this inventory. Preserve their commit SHAs and refs until explicit archival or deletion; never force-reset a branch and present that as integration.

## Google Drive research intake: newly observed 2026-11-19

These are user-owned research assets held in Google Drive and **not automatically published or imported into main**:

- `TSM-Links-12-Software-Data-2026-11-19`: 22 direct files, including eight county-specific FEMA NFHL GeoJSON extracts, USACE CWMS/Louisville timeseries/location catalogs, MODFLOW archives and HEC-RAS installer. Recheck feature currency, effective FEMA version, incorporated LOMCs, polygon CRS/validity, authority fields and service timestamps before engineering use.
- `TSM-Paint-Material-BIM-DEM-DSM-2026-11-19`: 59 direct files, including USACE NSI modeled inventory, county material/roof tags from OSM and Overture, ISGS terrain metadata and a provenance report. OSM/Overture appearance tags are **estimated**, not surveyed or independent height measurements, and must not affect regulatory computations.
- `TSM Official Geodata Warehouse - Eight Counties`: organized county folders and source receipts including DoWORC originals, separate from code and publicly distributable small catalogs.
- `coverage-provenance-report-2026-11-19.md` records a **15-building disagreement**: reported verified regional LOD1 total 181,507 versus a stated sum of county-level files 181,522 (9 Vanderburgh and 6 Warrick). **Do not change the denominator or certify new totals** until identities and per-county sources are reconciled.
- The report identifies initial OSM queries that selected counties with the same names in other states. Use the v3 FIPS/OSM-area-resolved outputs, retain source query and retrieval timestamp, and explicitly invalidate earlier mismatched counts. OSM material-tag coverage is near zero; unknown materials remain unknown.

These findings are *inventory and evidence-gate observations*, not proof that the stored raw data has been independently rehashed, cross-joined against effective FEMA panels or passed datum validation in this repo.

## Release and verification gates

1. For each subsequently merged PR, verify all required checks on the **exact latest main SHA**; skipped jobs and ordinary console/Tauri Windows CI are not native UE5.8 Shipping evidence.
2. Headed browser: direct memorial route, USGS stage/timestamp/stale states and NAVD88 cautions, small-screen collapsible flood/map controls, Cesium 3D building toggle/road names/flyover and screen reader labels. Preserve rendered screenshots and run/job IDs.
3. Native UE5.8: self-hosted Win64 Shipping BuildCookRun must execute, produce signed or traceable build artifacts with hashes, and pass clean Windows 11 network-disabled executable launch without localhost/WebView/Node. Historical run `44406387308` `package-windows` job `135162619072` was queued with zero executed steps at last check; never call it passed.
4. Data: validate NFHL effective features and LOMCs before regulatory parcel screening; independently reconcile 181,507 vs 181,522 source buildings; keep regulatory flood surfaces separate from modeled NSI or crowdsourced appearance.
5. Delete or archive obsolete branches only after verifying no unique desired changes and retaining audit references. Tracking issue #680 remains open until these executable and data gates are evidenced.

This reconciliation rejects dangerous whole-branch merges while preserving the documented useful functionality already present on main.
