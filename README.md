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
| **Engineering 3D twin** | A published screening inventory includes **22,815** 3D building entries with derived height attributes; the authoritative candidate source has **23,082** building identities. Terrain, imagery and LiDAR workflows exist. | **267 identities** are not represented in that published screening layer; complete countywide geometry, height, terrain and 3D Tiles acceptance remains open. |
| **2020 Indiana LiDAR recovery** | Official Indiana GIO public S3 source paths for COPC, nDHM, DSM and DEM have been inventoried. Source candidates and diagnostic QA are recorded. | Raster availability and tile coverage do **not** prove roof height or ground elevation for each building. |
| **Hydrology and hydraulics** | The repo contains scenario/model integration, HEC-related tooling and evidence contracts. | No automatic No-Rise, LOMA, floodway, levee-safety or permit determination. Model-specific inputs and expert review remain necessary. |
| **Government data fabric** | Adapters, source registries, validation tests and provenance structures cover federal and state datasets. | Freshness, completeness, licensing and agency authority must be checked for each dataset. |
| **Windows 11 native/offline goal** | Unreal Engine 5.8 contracts and Windows build automation are in the repository. | A signed, verified, distributable **Windows x64 Shipping installer is not yet established** by this README. Offline assets must be bundled and validated. |
| **Photorealistic presentation** | Optional Cesium-hosted presentation and viewer paths are documented. | Third-party tiles, account requirements and connectivity differ from the self-hosted/offline engineering twin. |

**These are different evidence levels:** an **observation** is a measurement from a named source; a **derived value** is calculated from source data; a **scenario** explores assumptions; a **regulatory determination** is made by an authorized agency or qualified professional. The software must never relabel one as another.

### 3D buildings: the current acceptance gap

The full Posey County source inventory contains **23,082** IGIO building footprint identities. The earlier public screening layer contains **22,815** entries, leaving **267 source identities** to reconcile. A separate LiDAR height-recovery diagnostic reported **11,821 observed heights**, **8,696 derived heights** and **2,565 unavailable accepted heights**, plus **29 terrain-sampling gaps**. Those figures come from different versioned products and **must not be combined as if they were one accepted build**.

Before declaring the countywide 3D product complete, the project must verify source-ID reconciliation, valid polygon topology, horizontal and vertical reference systems, per-building roof and ground evidence, GLB geometry, hierarchical levels of detail, 3D Tiles schema/content and reproducible validation receipts.

[Track building acceptance issue #416](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/416) · [Indiana Elevation Registry research](docs/geospatial/INDIANA-ELEVATION-REGISTRY.md) · [Formal acceptance protocol](docs/validation/AUTHORITY-ACCEPTANCE-PROTOCOL-2026-10-25.md)

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
