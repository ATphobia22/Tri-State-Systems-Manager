# True-source TSM 4D community cinematic — production workflow

**Status:** UE5.8 Sequencer/MRQ *source integration and guarded render scripts*, not a completed Unreal film. The current production contract requires staged, hash-checked terrain and building assets and an existing real `/Game/TSM/Maps/TSMNative.umap`. The MRQ sequence and preset must exist as true Unreal assets, and the selected MRQ PNG output path must be configured to the wrapper's run-specific `frames` directory. A passing Python unit test does not compile Unreal.

## County-specific geography

Exact FIPS: Posey IN `18129`, Henderson KY `21101`, Union KY `21225`, White IL `17193`, Wabash IL `17185`, Gallatin IL `17059`. This six-county film scope differs from older eight-county forecasting or road-service bounding boxes. Clip and cross-check **exact county geometries** before building assets; do not accept whole-bbox tiles as county-only coverage without feature-by-feature clipping and provenance.

`data/cinematic/six-county-authoritative-elevation-source-catalog.json` records public discovery endpoints. Sources include:

* [ISGS ILHMP LiDAR](https://clearinghouse.isgs.illinois.edu/data/elevation/lidar/) — Gallatin collections for 2011 and 2020, and the Wabash/White 2020 county releases. Review each actual project XML and tile-index polygons; do not download 184 GB of LAS merely to create a demo flyover.
* [Kentucky DGI KyFromAbove](https://kyfromabove.ky.gov/) and [STAC API](https://spved5ihrl.execute-api.us-west-2.amazonaws.com/) — query only Henderson/Union exact county polygons; retrieve bare-earth DEM and LAZ metadata, plus orthophotos if permitted.
* [USGS 3DEP](https://apps.nationalmap.gov/3depdem/) / [3DEP spatial metadata](https://www.usgs.gov/3d-elevation-program/3dep-spatial-metadata) — cross-border fallback; verify individual product raster headers, metadata XML and work unit dates.
* Posey identity evidence: [Drive source verification](../engineering-development/POSEY-DRIVE-SOURCE-VERIFICATION-2026-11-09.md) reconciled **23,082 equal footprint identities/geometry**, **not** 23,082 scientifically validated LoD3 roof meshes. Two DEMs are EPSG:2968 (NAD83 HARN), NOT EPSG:2966; their elevation-band vertical datum/units were not established by TIFF headers.

**Datum rule:** Never assign NAVD88/GEOID18 to a tile from a general catalog statement. Record actual source CRS/realization, vertical datum, geoid model, vertical units, applicable grid transformations and propagated uncertainty; transformed rasters need independent checkpoint and edge/seam tests. Do not assume the Kentucky and Illinois project geoid models match.

## Build sequence

1. Discover, download and validate real county AOI products with SHA-256 and metadata; keep large originals outside Git and stage reviewed tiles in `TSMData`.
2. Preserve original building polygon coordinates/IDs; optionally run [Building-Regulariser](https://github.com/DPIRD-DMA/Building-Regulariser) on a **derived** branch of geometry. Compare area, offset, topology and intersection-over-union before acceptance. The Git repository's MIT code license does not relicense the underlying building datasets.
3. Independently measure/validate roof-height inputs. The [LiDAR + footprint solar potential example](https://github.com/SustainableUrbanSystemsLab/CP-SIGRADI2024-Assessing-Solar-Potential-of-Buildings-Using-LiDAR-and-Footprint-Data), [LOD3_buildings](https://github.com/ATphobia22/LOD3_buildings) and [Multilabel-BONAI](https://github.com/bipulneupane/Multilabel-BONAI) are candidate methods, not proof of measured Posey roof heights. BONAI is a trained-dataset method, not a neutral local geometry authority.
4. Generate validated GLB/3D Tiles/HLOD from the existing TSM pipelines; attach feature source IDs, byte hashes, county FIPS and datum records.
5. Verify true native UE map and local tiles; asset registration into scene must be checked. Import source-derived waterways and scenario polygons only if independently verified; use a presentation-class translucent water surface with **no fabricated engineering depth labels** otherwise.
6. Prepare a **5+ minute** `tsm.cinematic.production.v1` manifest from actual UE world-space camera poses, a real `LS_TSMCommunity` LevelSequence and `MRQ_TSMCommunity` preset with shot ordering. Use `scripts/cinema/validate_cinematic_production.py` for data checksums and timeline preflight.
7. Run `scripts/cinema/Invoke-TSMVerifiedMovieRender.ps1` on a Windows UE5.8 GPU runner, using real native assets. Render 1080p/4K PNG frames using Movie Render Queue; require independent visual scene screenshots, output frame count, FPS/VRAM and logs.
8. If both supplied music recordings are cleared for distribution, compose with `scripts/cinema/mux_verified_mrq_movie.py --confirm-music-rights` and inspect output frame/audio metadata and file hashes. Assemble narration and titles without claiming cinematic footage contains measured flood depths unless a trusted hydraulic model supports them.

## Scene plan (minimum 5 min, actual UE content required)

| Shot group | Suggested cut | Claims and guardrails |
|---|---|---|
| Regional flyover | Wabash / Ohio corridor, sunset | Camera locations must be measured/placed in local UE world coordinates |
| Six-county map | county outline lights | Exact FIPS and polygon masks; schematic overlay clearly labeled |
| Mount Vernon | terrain roads & buildings | real source identities; estimated building heights identified |
| Gallatin / Union | banks and regional relief | actual DEM source tiles and correct datum; no invented seam elevation |
| 3D layers | terrain → footprints → mesh | show missing-data and derived-vs-observed layers |
| 4D water | time scrub with flood scenario | explicitly presentation or independently calibrated scenario; no invented levels |
| Provenance | metadata and hashes | clickable source receipt, CRS and datum, human review state |
| Community impacts | farm, road, infrastructure use | no emergency alert or federal regulatory implication |
| Closing | Earth / region wide pullback | free public-interest software; scientific evidence gates remain |

## Repository choices and licensing

| External repository | Adoption decision |
|---|---|
| DPIRD-DMA/Building-Regulariser | High-value candidate, MIT; experimental polygon regularizer with geometry-difference gate before source replacement |
| kapase16/spongekit | Candidate urban roof runoff/retention, **screening only**; route results through source-aware evidence and optional SWMM validation |
| PeiChiTsai/geojson-buildings-to-3dtiles | Compare pipeline and validator; prefer TSM's existing 3D Tiles/HLOD implementation until licensing, output formats and topology are checked |
| anmol-ix/roof-area-poc | Turf.js area estimation ideas; do not introduce Mapbox tokens or web service dependence in native offline runtime |
| SuyamaCorporation roof estimator | Roof geometry/material estimates are not measured roof faces; audit model data and license before use |
| bipulneupane/Multilabel-BONAI | Optional off-nadir model candidate, training data and licenses must be reviewed; never auto-approve masks |
| SustainableUrbanSystemsLab solar potential | Candidate derived solar/roof analytic layer with documented uncertainty |
| milos-agathon/3d-city-buildings | R/rayshader aesthetic inspiration only; not authoritative local structures |
| monumentalco/boundless.worlds | Creative world-builder nodes licensed CC BY 4.0; use only for clearly **illustrative** landscapes, not DEM substitutions |
| ATphobia22/TellusBuilder / LOD3_buildings | Candidate photogrammetry/LOD3 workflows; raw cameras, model weights and source observations required |
| ATphobia22/WorldBuilder | Geodynamic tectonic initial-condition generator, **not** a city terrain importer |
| ATphobia22/openshot-qt and rezoo/movis | Alternative editing/motion-graphics assembly tools; MRQ remains primary renderer |
| Top3d-ai/world-builder, Paper2Video, Code2Video, CogVideo, HunyuanVideo, InfiniteTalk | Optional creative work only, not evidence-backed county geography; GPU/weights/license/privacy review before external model downloads |
| autowarefoundation/autoware | Reference for localization, mapping and fusion patterns; not hydraulic modeling |

No upstream source files were copied by this PR. Missing or restrictive upstream licenses prevent automatic vendor/import.

## Eight package integrations

New `packages/{survey,cogo,least-squares,landxml,openmi,forecasting,release-gates,approval-workflows}` folders provide entry-point adapters, conservative release checks and human authorization boundaries. Mathematical and interop authority remains in existing `backend/survey`, `backend/openmi_*`, `scripts/flood-forecasting/` and `schemas/tsm-release-gate-schema.json`, avoiding a second competing solver.

## Unclosed acceptance

A successful rendered community film, calibrated flood model, actual UE Sequencer assets, fully verified 23,082 building meshes, cross-county continuous DEM and datum, Windows 11 air-gapped Shipping installer, and any signed regulatory filing are **not** demonstrated by this source-only change. These require raw data, real runner, actual rendered frames and separate third-party checks.
