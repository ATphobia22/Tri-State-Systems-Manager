# Tri-State Systems Manager (TSM)

**An open-source river-valley information, mapping and engineering research platform for communities along the Ohio and Wabash Rivers in Indiana, Illinois and Kentucky.**

**Project stage: active development and scientific validation — not a finished or certified public-safety product.**

[Explore the public console](https://atphobia22.github.io/Tri-State-Systems-Manager/) · [See the code](https://github.com/ATphobia22/Tri-State-Systems-Manager) · [Report a problem](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues) · [Read the engineering assurance standard](docs/architecture/ENGINEERING-ASSURANCE-STANDARD.md)

> **Our principle:** Technology informs people; it does not silently govern them. People and responsible agencies retain decision-making authority.

## For families in the Tri-State River Valley

The Ohio and Wabash Rivers connect our towns, farms, roads, homes, wetlands and businesses. They also bring flooding and other challenges. TSM is being built to help people **see public information about the places they care about, understand where that information comes from, and explore possible conditions** in one place.

You do not need to be an engineer to explore the public-facing parts of the project. Public reading is intended to be free and anonymous; privileged changes and agency decisions require appropriate authorization. Some screens and datasets are still experimental, incomplete or unavailable.

### What can you use it for?

| Question | How TSM can help | What it cannot promise |
|---|---|---|
| **How high is the river?** | Show or retrieve published river-gage observations, including USGS and NOAA sources, with station and observation context. | The map is **not** an emergency alert service. Readings can be delayed, missing or on different gage datums. |
| **Is my neighborhood in a mapped flood area?** | Display available FEMA flood-map layers and Indiana floodplain information alongside roads, terrain and other context. | Only the appropriate agency can provide an official determination. A map screenshot is not an elevation certificate. |
| **What could flooding look like?** | Explore mapped scenarios and engineering-model outputs when their input data and validation status are available. | A scenario is **not** a prediction for your house, a guarantee of safety, or an approved hydraulic study. |
| **What does our valley look like in 3D?** | Explore terrain and a partial 3D-building visualization, with source and height-evidence information. | Some buildings and heights are missing or unverified; 3D appearance does not prove survey accuracy. |
| **Where did this information come from?** | Inspect evidence/provenance records and links to public agencies where implemented. | A listed source is not proof that its newest data was downloaded, validated or refreshed. |

**During a flood or other emergency:** follow local emergency management, the National Weather Service and official evacuation instructions. Do not use TSM as the sole basis for emergency action. [National Weather Service](https://www.weather.gov/) · [FEMA Flood Map Service Center](https://msc.fema.gov/portal/home)

### The difference between a river reading and a property elevation

A gage's **stage** is measured relative to that gage's own reference zero. A building's **ground elevation** and a floodplain's **base flood elevation** use specified vertical reference systems. Those numbers cannot safely be compared until their datums and units are verified. TSM is designed to show this distinction rather than silently combine incompatible measurements.

## What exists today, and what is still being built?

| Area | Evidence-backed current description | Release boundary |
|---|---|---|
| **Public web console** | Source code and public GitHub Pages deployment are available. Mapping, evidence and engineering screens are implemented. | A deployed screen does not establish every feature or external service is working now. |
| **River data and forecasting** | USGS/NOAA data adapters and forecasting scripts exist, including TimesFM and GEOGloWS integration paths. | A script or prior successful test is not a current verified forecast, official warning or operational service-level guarantee. |
| **Engineering 3D twin** | A published GeoJSON screening inventory includes **22,815** footprints and derived height attributes, versus **23,082** identities in the pinned, project-archived IGIO-labeled source. The public viewer now exposes the **267 missing OBJECTIDs** for inspection and JSON download. | The renderable 3D mesh is a separate, smaller dataset; neither the screening count nor the archived identity comparison proves 3D Tiles/HLOD completeness, valid elevation provenance or agency-certified source vintage. |
| **2020 Indiana LiDAR recovery** | Official Indiana GIO public S3 source paths for COPC, nDHM, DSM and DEM have been inventoried. Source candidates and diagnostic QA are recorded. | Raster availability and tile coverage do **not** prove roof height or ground elevation for each building. |
| **Hydrology and hydraulics** | The repo contains scenario/model integration, HEC-related tooling and evidence contracts. | No automatic No-Rise, LOMA, floodway, levee-safety or permit determination. Model-specific inputs and expert review remain necessary. |
| **Government data fabric** | Adapters, source registries, validation tests and provenance structures cover federal and state datasets. | Freshness, completeness, licensing and agency authority must be checked for each dataset. |
| **Windows 11 native/offline goal** | Unreal Engine 5.8 source/contracts and a self-hosted Windows Shipping packaging workflow exist. Web/Tauri preview builds are **separate deliverables**. | No verified Windows 11 x64 UE 5.8 Shipping `.exe`/installer, clean-host network-disabled boot, headed FPS/VRAM evidence, artifact attestation or signing trust classification has been established. See [native release gate #414](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/414). |
| **Photorealistic presentation** | Optional Cesium-hosted presentation and viewer paths are documented. | Third-party tiles, account requirements and connectivity differ from the self-hosted/offline engineering twin. |

**These are different evidence levels:** an **observation** is a measurement from a named source; a **derived value** is calculated from source data; a **scenario** explores assumptions; a **regulatory determination** is made by an authorized agency or qualified professional. The software must never relabel one as another.

### 3D buildings: the current acceptance gap

The full Posey County source inventory contains **23,082** IGIO building footprint identities. The earlier public screening layer contains **22,815** entries, leaving **267 source identities** to reconcile. A separate LiDAR height-recovery diagnostic reported **11,821 observed heights**, **8,696 derived heights** and **2,565 unavailable accepted heights**, plus **29 terrain-sampling gaps**. Those figures come from different versioned products and **must not be combined as if they were one accepted build**.

Before declaring the countywide 3D product complete, the project must verify source-ID reconciliation, valid polygon topology, horizontal and vertical reference systems, per-building roof and ground evidence, GLB geometry, hierarchical levels of detail, 3D Tiles schema/content and reproducible validation receipts.

[Historical building acceptance issue #416 (closed; scientific acceptance still unverified)](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/416) · [Public missing-OBJECTID inventory](tsm-console/public/3d-tiles/posey-missing-objectids.json) · [Indiana Elevation Registry research](docs/geospatial/INDIANA-ELEVATION-REGISTRY.md) · [Formal acceptance protocol](docs/validation/AUTHORITY-ACCEPTANCE-PROTOCOL-2026-10-25.md)

### Verification snapshot — November 3, 2026

This is a **dated evidence snapshot**, not a live CI dashboard or a certified release. The public missing-ID disclosure was merged in [PR #493](https://github.com/ATphobia22/Tri-State-Systems-Manager/pull/493) (commit [`f1de9a5`](https://github.com/ATphobia22/Tri-State-Systems-Manager/commit/f1de9a5ff7b1130c3e301892100e6fa725bbcc6a)). It retains **22,815 / 23,082 (98.84%)** screening coverage with an expandable list of the **267 absent archived OBJECTIDs** and a downloadable, informational-only JSON manifest. The [pinned archived source-vs-publication difference](data/buildings/POSEY-ARCHIVED-IGIO-IDENTITY-DELTA-2026-10-25.json) includes source and published SHA-256 values; the archive's **original agency vintage remains independently unverified**. A set-difference proof is **not** a mesh or height acceptance receipt.

The strict 3D-building workflow in [PR #492](https://github.com/ATphobia22/Tri-State-Systems-Manager/pull/492) reported **2,565 buildings without required accepted height evidence** and failed its 23,082-building gate. A separate user-supplied 23,082-feature GeoJSON candidate was inspected on November 3: its identity count is complete, but an initial geometry audit found **12 self-intersecting polygons** (including `740387` and `741040` in the archived missing-ID list) and **12,155 default 4 m height values**. This uploaded file is **not part of the repository's pinned authoritative source**, and its Overture-derived heights, OpenTopoData ground elevations, horizontal/vertical transformations, source vintage and licensing need independent verification. Never treat it as 23,082 validated buildings or silently use default heights to pass the scientific gate. Those topology findings are observations about the separate candidate file, **not proven omission causes**.

[Issue #416](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/416) is administratively **closed**, but that issue state does not provide the missing scientific release evidence. Countywide acceptance still requires one source-bound record per verified OBJECTID; explicit topology and no-data/raster-window diagnosis; horizontal EPSG, vertical **NAVD88**, geoid and unit provenance; method-quality and LOD1/LOD2 fallback outcomes; validated glTF/3D Tiles/HLOD content; reproducible SHA-256 inventories; and independent expert review. Do not disable provenance warnings to make a partial scene appear complete.

**Native release gate:** [Issue #414](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/414) remains open. The self-hosted `[windows,x64,ue5]` runner must have a properly licensed UE 5.8 installation, `UE_ROOT`, Cesium/SQLite plugins and MSVC. A reviewed immutable `main` SHA must be packaged with `package_windows: true`, followed by full BuildCookRun logs, clean Windows 11 network-disabled boot, **no WebView/Node/localhost** dependency, staged TSMData checksums and datum metadata, missing-evidence UI checks, headed cinematic screenshots and FPS/VRAM/hardware receipts, installer/uninstaller smoke tests and trusted signing/attestation. A green source-contract job or a **Web/Tauri** artifact cannot satisfy this independent UE Shipping gate.

**Model authority boundary:** HEC-HMS, HEC-RAS, MODFLOW and related integrations are informational/model-assistance tooling unless verified inputs, calibration, solver execution/status, domain-specific acceptance and accountable human approval are recorded. TSM does not make automatic floodplain, permit, design or emergency decisions.

### Release-desk reconciliation — November 7, 2026

[Release desk](https://tri-state-release-desk.flaredthyme1.chatgpt.site) tracks scoped evidence; it is a dated snapshot, not live synchronization. At inspected main [`ba0657896c95ce6a20fa74cb821a0637ddedcadf`](https://github.com/ATphobia22/Tri-State-Systems-Manager/commit/ba0657896c95ce6a20fa74cb821a0637ddedcadf), GitHub returned **zero open PRs** and **21 successful workflow runs**. Earlier references to PRs #488–#492 as outstanding are historical. Those run conclusions do not establish required-check completeness or native Shipping acceptance.

The remaining `fix/transvoxel-coarse-scalar-correctness-20261023` branch at `a2c45699bac068832bb761c6687c3ee848dfb86d` is **0 commits ahead / 584 behind** that main revision, with no diff. Its work is already reachable from main; another merge is unnecessary.

Local rechecks passed the native product contract and **20 Shipping-verifier tests**. They validate software behavior using fixtures; they do not prove an actual Windows launch. The explicit building validator rejects the public root external-tileset URI and rejects the child tileset's missing explicit authority flags. The root references an **implicit** tileset; those diagnostics also reveal a validator scope mismatch, not proof that external tilesets are invalid OGC content. Full external/implicit 3D Tiles and glTF validation remains required. Keep **22,815 screening footprints**, the separate **20,517 height-evidence diagnostic**, and actual mesh counts distinct.

No connected Windows Desktop Commander device was available during this reconciliation, and the GitHub connector exposes no workflow-dispatch operation. Windows packaging was **not dispatched**, and runner availability was not verified. Gate #414 remains open for a genuine package, staged-data verification, disconnected clean-host launch, native missing-evidence UI, `.umap`, cinematic measurements, signing and installation receipts. The workflow now preserves any generated Windows BuildCookRun transcript as an artifact even after a failed build; absence before packaging is reported as a warning, never fabricated success.

See [GitHub Actions](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions) and [open pull requests](https://github.com/ATphobia22/Tri-State-Systems-Manager/pulls) for newer state.

### Release implementation progress — November 7, 2026

[PR #497](https://github.com/ATphobia22/Tri-State-Systems-Manager/pull/497) is merged at `86067bba11a0eef4a5123100231f20fd90246b8a`: the native dependency probe uses macOS 15, and Windows BuildCookRun transcripts are retained on success or failure. Its 24 successful and six skipped checks were reviewed; native packaging was skipped and is still a separate gate.

Three follow-up changes have separate review scopes: [#498](https://github.com/ATphobia22/Tri-State-Systems-Manager/pull/498) fixes the glTF writer/repair and feature-linkage checks; [#499](https://github.com/ATphobia22/Tri-State-Systems-Manager/pull/499) repairs manifest self-verification, protects staged data on copy failure, and stages physical files for Cesium/SQLite; [#500](https://github.com/ATphobia22/Tri-State-Systems-Manager/pull/500) publishes the reviewed 718-GLB format repair with checksums and locked independent format CI. Consult their latest heads and checks before merging; these references do not claim all three are already on main.

The repaired visualization subset contains **20,517 independently recounted OBJECTIDs in 718 GLBs**. Complete before/after comparison preserves geometry, transforms and source metadata. Cesium `3d-tiles-validator@0.6.1` reports zero errors and zero warnings, with 718 information groups including unsupported-extension notices. This is scoped format/identity evidence; **2,565 accepted heights are still unavailable**, the 22,815-feature screening inventory is a different product, and whole-catalog datum, full source vintage, native rendering and full 23,082-building acceptance remain open.

Local verification passed 13 snapshot-integrity/staging tests, 20 Shipping-verifier fixture tests, 12 native contract tests and 11 glTF builder/repair/layout tests. These tests do not establish an installed Windows package. [Issues #414](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/414) and [#416](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/416) remain the independent native and countywide engineering acceptance records.

## Geography and source agencies

TSM focuses on the Ohio–Wabash confluence and surrounding Indiana–Illinois–Kentucky communities, with initial detailed engineering work in **Posey County, Indiana**. A regional map does **not** mean every county has equally complete datasets or validated models.

Key public-information authorities and products include:

| Source | Why it matters |
|---|---|
| [USGS Water Data](https://waterdata.usgs.gov/) | River observations and station metadata |
| [NOAA / National Weather Service](https://water.noaa.gov/) | River forecasts, weather warnings and official flood-stage context |
| [FEMA Flood Map Service Center](https://msc.fema.gov/portal/home) | Effective flood insurance rate maps and related map products |
| [Indiana DNR Division of Water](https://www.in.gov/dnr/water/) | Indiana floodplain information, analyses and permitting context |
| [Indiana GIO elevation catalog](https://registry.opendata.aws/in-elevation/) | Public elevation and LiDAR source archives |
| [U.S. Army Corps of Engineers](https://www.lrd.usace.army.mil/Missions/Regulatory/Indiana/) | Applicable regulatory and water-resources information |
| [USDA NRCS](https://www.nrcs.usda.gov/) | Soil surveys and agricultural land information |
| [USFWS National Wetlands Inventory](https://www.fws.gov/program/national-wetlands-inventory) | Wetland mapping for screening, not jurisdictional delineation |

See the [government agency source audit](docs/evidence/GOVERNMENT-AGENCY-SOURCE-GAP-REVIEW-2026-10-26.md) for data status and agency authority boundaries. Historical plat books and insurance correspondence are **context only**; they are not current property surveys or flood determinations. Personal addresses, policy identifiers and other private evidence must not be published.

## For researchers, engineers and peer reviewers

TSM's goal is **reproducible evidence, not unexplained map confidence**. A peer review should be able to identify the source vintage, spatial reference system, vertical datum, units, geometry/measurement methods, transformations, assumptions, tests, failure states and accountable human reviewer.

**Start with:**

1. [Engineering Assurance Standard](docs/architecture/ENGINEERING-ASSURANCE-STANDARD.md) — evidence classes, numerical verification and review requirements.
2. [Authority Acceptance Protocol](docs/validation/AUTHORITY-ACCEPTANCE-PROTOCOL-2026-10-25.md) — scientific and jurisdictional acceptance boundaries.
3. [Technical Release Gates](docs/architecture/TECHNICAL-RELEASE-GATES.md) — software checks versus hydraulic/geodetic authority.
4. [Government source gap review](docs/evidence/GOVERNMENT-AGENCY-SOURCE-GAP-REVIEW-2026-10-26.md) — official sources and limits.
5. [Open issues](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues) and [CI workflows](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions) — current failures, build receipts and unresolved work.

### Reproducibility and trust boundaries

- **Provenance:** capture source identifier, download/snapshot date, dataset vintage, checksum, transformations, software version and review decision.
- **Geodesy:** state horizontal CRS, vertical datum, units and transformation method. Do not treat gage stage as NAVD88 elevation without verified station-zero metadata.
- **Scientific honesty:** label `OBSERVED`, `DERIVED`, `SCENARIO`, `UNAVAILABLE` and review-required states; missing evidence cannot be synthesized into regulatory truth.
- **Geometry:** preserve original building identifiers and topology, record invalid or absent source polygons and distinguish visual approximations from measured structures.
- **Testing:** a green software CI run is necessary but **not sufficient** for scientific, survey, environmental or regulatory certification.
- **Human oversight:** floodway, No-Rise, LOMA, design, permitting and evacuation decisions stay with the appropriate professionals and agencies.
- **Privacy:** public outputs must exclude private household and insurance identifiers, credentials and unauthorized parcel-owner information.

### Build and test the software

Prerequisites: Git, **Node.js 22+**, npm, and the separate Python/model dependencies required by whichever subsystem you are testing.

```bash
git clone https://github.com/ATphobia22/Tri-State-Systems-Manager.git
cd Tri-State-Systems-Manager

# Install and run the public web console locally
cd tsm-console
npm ci
npm run dev

# In a second shell, from the repository root:
npm ci
npm run test:posey-government-evidence
npm run test:posey-geodetic-reference
```

Full root tests and native builds have additional environment, dependency and data prerequisites. Consult [CONTRIBUTING.md](CONTRIBUTING.md), workflow definitions in [`.github/workflows/`](.github/workflows/), and subsystem runbooks before executing hydrology or 3D production pipelines. Do not interpret a test pass as a validated flood prediction.

## Survey interchange and computations

The [offline survey preprocessing tool](tools/survey/README.md) imports scoped LandXML point/TIN data, preserves original survey collections, exports presentation GLBs, and provides COGO, weighted least-squares/leveling, offline PROJ and GeographicLib computations. It is separate from the native Unreal runtime. Imported data retains unverified datum/authority status until independently reviewed; external solver execution, XSD validity and renderable geometry do not confer survey acceptance.

## Project direction

TSM is designed to grow toward a local-first, offline-capable, cinematic **Unreal Engine 5.8 Windows 11 x64 digital twin**, while keeping the public web console accessible without an account. Planned capabilities include richer 3D buildings and terrain, reproducible hydraulic scenarios, agricultural and ecological overlays, and exportable evidence packages. These are **goals**, not claims of completed deployment.

Priority release work includes full 23,082-building acceptance, authoritative height/terrain reconciliation, validated 3D Tiles and LODs, tested Windows distribution, and independent scientific review. Status can change as new evidence arrives; inspect linked CI and issue records rather than relying on a static README as a live status dashboard.

## Participate and review

Community members can report broken links, unclear maps, accessibility problems, incorrect source attribution or local context that needs verification. Researchers can propose reproducible tests and source corrections. Do **not** post private addresses, insurance letters, identifying household records, or sensitive infrastructure details in public issues.

[Contribution guide](CONTRIBUTING.md) · [Security reporting](SECURITY.md) · [Open issues](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues)

---

**In memory of Beverly Ann Tucker.** This dedication is personal and does not constitute engineering or regulatory evidence.

**License:** [Apache-2.0](LICENSE). Some external data and hosted services have their own licensing, attribution and access conditions.

**Disclaimer:** TSM is research and decision-support software. It is not an official flood warning system, an elevation certificate, a licensed engineering or land-survey service, or a substitute for FEMA, state DNR, USACE, NWS, local emergency management, or other competent authorities.

## Unreal authoring and training integrations

See [Unreal authoring tools](docs/unreal-authoring-tools.md) for provenance-checked Blender/Houdini FBX import, local Cesium actor configuration, asset naming checks, optional human-acknowledged FlowGraph training steps, and headed cinematic capture. The FlowGraph training plugin is disabled by default. Python checks do not establish a native UE5.8 build, generated map, complete building dataset, or offline Windows release.
