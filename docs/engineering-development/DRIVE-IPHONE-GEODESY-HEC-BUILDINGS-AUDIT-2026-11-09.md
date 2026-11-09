# Drive TSM iPhone Videos: building, datum and HEC source audit (2026-11-09)

**Status:** Evidence audit / not an engineering or native release certification.
**Reference main:** `f6e76cae8cc039902bde4c04ace952584ec92faa`.
**Source folder:** https://drive.google.com/drive/folders/1HahOfbZzNxP_ydoW9TSJT1zYB_zFnoG6
**Checksummed evidence subfolder:** https://drive.google.com/drive/folders/1QvSnec14KQOcdz3-GpFx7dmmf_2YTAZf

## P0 — unsafe supplied Python datum + HEC gate prototype: DO NOT INTEGRATE

Drive [`verify-navd88-geoid18.py`](https://drive.google.com/file/d/1wiZwoMtSxBaoefnB0maT0vQw9Av5lWvl/view) is not a verification authority.

- Its static USGS `03378500` New Harmony gauge-zero constant is **353.20 ft NAVD88** and claims an unsupported `VERIFIED` benchmark tie-in. The [2016 USGS SIR 2016-5119](https://pubs.usgs.gov/sir/2016/5119/sir20165119.pdf) documents **352.67 ft** for that report's stage-to-NAVD88 relationship. The [current USGS monitoring-location metadata](https://waterdata.usgs.gov/monitoring-location/USGS-03378500/) states **352.71 ft NAVD88** for station altitude; verify whether those measurements are the same datum quantity and effective period before treating them as interchangeable. The Drive prototype exceeds those published records by **0.53 ft** and **0.49 ft**, respectively.
- `Geoid18Calculator.calculate_orthometric_height` labels caller-provided geoid/ellipsoid values `VERIFIED` without a geoid grid, matched NAD83(2011) epoch, benchmark/projection transformation evidence, or finite-value protection. [NGS GEOID18](https://www.ngs.noaa.gov/GEOID/GEOID18/geoid18_tech_details.shtml) specifies NAD83(2011), epoch 2010.0; the Posey DEM source documents NAD83(HARN)/EPSG:2968, not equivalent without transformation.
- `HECReleaseGateChecker` accepts any solver field *starting* `sha256:` and any nonempty claimed PE license plus `human_authorized=true`, without authenticating a solver result or engineer. **Negative test run:** fabricated AOI + `solver_files={"geometry":"sha256:garbage"}` + `pe_license_number="NOT-A-REAL-PE"` returned `APPROVED_FOR_RELEASE` and Gate 4 `PASS`.
- Its included demonstration reports `APPROVED_FOR_RELEASE` without a real HEC solver execution, terrain/checkpoint proof, or signoff.
- The Drive [`hec-gate-schema.json`](https://drive.google.com/file/d/1k8YziWLkbOqR6X2dwFxc7FZv1v2US9Cv/view) fails `jsonschema.Draft202012Validator.check_schema`: `properties` values are strings/lists instead of schema objects. It is an illustrative JSON object, **not** deployable JSON Schema.

**Preserve** GitHub `tsm-console/src/lib/geodetic/station-datum-verifier.ts` and `tsm-console/src/lib/hec-release-gates.ts`: they validate identity/provenance contracts and recompute supplied digest bytes. Their green output is an internal consistency check, not an independently authenticated agency publication or modeled engineering approval. Do not import the Drive prototype, nor downgrade the GitHub checks.

## P0 — source buildings reconcile; all heights remain estimates

Compared the Drive copies of `posey-igio-buildings.geojson` and `buildings-3d.geojson` as raw JSON using matching `properties.objectid` and geometry object equality:

| Evidence | Result |
|---|---:|
| Raw IGIO candidate SHA-256 | `172c2568864b6c012dc1fdebab245e25d64d23582d548a3c5a7b8eb09d8dec68` |
| Enriched candidate SHA-256 | `617a6116aaccac87354f0fa02285e322ec07c4e99ca9f0a14739f2c44f5cf881` |
| OBJECTIDs present in both | 23,082 / 23,082 |
| Exact geometry-object matches | 23,082 / 23,082 |
| Invalid source polygons (Shapely) | 12 |
| `DEFAULT_RURAL_MEDIAN` height sources | 12,155 |
| `OVERTURE_NEAREST_20M` height sources | 10,927 |
| `OPENTOPODATA_NED10M_GRID_0.01DEG` ground sources | 23,082 |

These two files supply **no independently verified measured roof heights**, approved bare-earth elevations, or LOD2/3/4 meshes. The raw candidate and 12 invalid footprints are **already documented** in `docs/geospatial/POSEY-IGIO-CANDIDATE-AUDIT.md`, and source hashes match `docs/engineering-development/POSEY-DRIVE-SOURCE-VERIFICATION-2026-11-09.md`. No duplicate source import or secret/raw data commit is warranted. Resolve invalid footprints by individual OBJECTID, retain original geometry, and label all inferred heights `DERIVED_UNREVIEWED`.

Drive screening file `main screening validator output.txt` is a **historical diagnostic**, reporting 22,815 features, not proof of a current accepted 23,082-building 3D Tiles set. Distinguish polygon presence from accepted meshes, and separately verify GLBs, topology, height evidence and HLOD.

## P0 — HEC release requirements require two layers

Drive `hec-release-gates-spec.md` has **five conceptual gates**: (1) AOI/watershed, (2) DEM, (3) station/terrain datum, (4) solver source files and hashes, (5) human/agency approval when applicable. GitHub `docs/architecture/TECHNICAL-RELEASE-GATES.md` intentionally implements the **first four as technical evidence gates**, leaving qualified professional/agency review as a distinct workflow when applicable. Preserve this separation; do not require an unconditional PE license to run basic open-source software.

The Drive [2010 Ohio River Community HEC-RAS paper](https://drive.google.com/file/d/1ObawF-iQfzc_kEfauhd3rlmGo9tDyXCH/view) documents historical datum harmonization, coupled modeling and calibration, but contains no presently executable approved TSM HEC model. Official [USACE HEC-RAS project-file guidance](https://www.hec.usace.army.mil/confluence/rasdocs/rasum/latest/working-with-projects) distinguishes `.gXX` geometry, `.uXX` **unsteady flow**, `.pXX` plan, `.rasmap`, `.pXX.hdf` results and computational logs. Require a real, version-pinned run, SHA-256 bytes, inputs, model stability/calibration and uncertainty evidence before publishing a model conclusion. Synthetic/demo source hashes must never be treated as verified solver executions.

USGS `03322420` is [Ohio River at Uniontown Dam](https://waterdata.usgs.gov/monitoring-location/USGS-03322420/), with distinct headwater and tailwater measurement qualifiers. Never extrapolate `03378500` New Harmony gauge stage to a Mount Vernon parcel without a validated hydraulic transfer.

## P1 — raster provenance / release state

The Drive-reconciled 2020 DEM TIFFs match recorded raw SHA-256 hashes and are **EPSG:2968 horizontal** with 2.5-ft pixel spacing. Embedded vertical datum and raster-value units were not independently confirmed. Do not treat them as EPSG:2966/GEOID18 validated NAVD88 engineering inputs without source-specific metadata, transformation and field checkpoints. 2025 leaf-on imagery and DSM have separately checked download receipts, but DSM is not bare-earth flood terrain.

The **UE5.8 native Win64 Shipping** executable and clean offline Windows 11 launch remain independently unevidenced by this Drive audit. Passing Tauri CI or GitHub source tests cannot close that gate.

## Follow-up checks

1. Keep the unsafe Drive script and malformed schema **outside production paths**; preserve only their source hashes and this negative-test finding.
2. Reconcile published USGS station datum **value + parameter qualifier + effective period + benchmark/source document hash**, then separately verify any site-level transfer.
3. QA invalid polygon identities, derived heights and measured LiDAR/DSM roof references; rerun accepted 3D Tiles and rooftop checkpoint gates.
4. Require real HEC input, output, logging, calibration and professional/agency review evidence before release promotion; validate any future JSON Schema against its metaschema and with negative examples.
5. Obtain independent UE5.8 Windows Shipping and offline user acceptance evidence.

**Audit scope:** selected Drive engineering files and the verified current GitHub source. The Drive folder has more than 200 entries; this is **not** an exhaustive ZIP/binary survey or a hydraulic engineering determination.
