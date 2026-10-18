# HEC-RAS Model 4449 — Acceptance Gates Status

**Date:** 2026-10-18
**Model:** Indiana DNR HydroModel ID 4449 — Ohio River, J. T. Myers (Uniontown) Pool FIS
**Archive:** `data/fabrics/hydraulic-models/ohio-river/model-4449-JTMyers-FIS.zip`
**Archive SHA-256:** `938dd9e593f6554b1b7d7095ff11eecc4862bf6c8a6966e88fd6db7f7ff5a7f6` (verified 2026-10-18)
**Disposition:** `CANDIDATE_ARCHIVE_ONLY`
**Execution authorization:** `NOT_GRANTED`

This document records the systematic gate-by-gate status of model 4449 based on direct archive extraction performed 2026-10-18. It does NOT constitute execution approval. That requires qualified human review (Gate 4), which is not recorded.

## Extracted Model Facts (from archive, 2026-10-18)

All facts below were read directly from the archive members, not inferred:

| Fact | Value | Source file |
|---|---|---|
| Units | English (feet) | `JTMyers.prj`: "English Units" |
| Vertical datum | **NGVD29** | `JTMyers.prj` DESCRIPTION: "1929 DATUM (NGVD)" |
| Reach | Ohio River, Uniontown Pool, mile 846 to 773 (project description) | `JTMyers.prj` DESCRIPTION |
| Geometry cross-sections | **47**, RM -777.3 to -844.75 | `JTMyers.g01` (counted) |
| Cross-section elevation range | 288.1 to 399.6 ft | `JTMyers.g01` (min/max of #Sta/Elev) |
| River/reach names | `RIVER-1`, `Reach-1` | `JTMyers.g01` |
| HEC-RAS versions | 3.12 (geometry), 3.11 (plan p01), 3.13 (plans p02, flows) | File headers |
| Plan p01 | "Floodway-FINAL 9/2005" — floodway encroachment, 5 profiles (Natural, Target -0.0', -0.1', -0.5', -1.0') | `JTMyers.p01` |
| Plan p02 | "Floodplain-Final 8/06" — floodplain, 4 profiles (10%, 2%, 1%, 0.2% events) | `JTMyers.p02` |
| Flow f01 | 870,000–925,000 cfs (100-yr floodway flows) | `JTMyers.f01` |
| Flow f02 | 646,000–1,080,000 cfs (10%/2%/1%/0.2% events) | `JTMyers.f02` |
| Flow data vintage | 1976 discharges | `JTMyers.prj` DESCRIPTION |
| Downstream boundary | Known WS 369.45–370.45 ft NGVD29 (varies by profile) | `JTMyers.f01` |
| Upstream boundary | Type 0 (normal depth assumed; not explicitly documented) | `JTMyers.f01` |
| Horizontal CRS embedded | **NONE** — HEC-RAS 3.1x did not store GIS projection metadata | Full-text grep of all members |
| Manning's n | 0.07 (overbanks), 0.026 (main channel) | `JTMyers.g01` #Mann records |

## Gate-by-Gate Status

### Gate 1: Horizontal CRS Verified

**Status: FAIL**

**Evidence:** A full-text search of all archive members (`JTMyers.prj`, `.g01`, `.f01`, `.f02`, `.p01`, `.p02`) found no GIS projection, EPSG code, state plane zone, or coordinate-system metadata. HEC-RAS 3.1x did not embed horizontal CRS. The geometry is expressed in river-station coordinates: cross-section stations in feet perpendicular to flow, river miles along the channel. These are local engineering coordinates, not a georeferenced map projection.

**What would pass:** DNR source metadata or a companion GIS file (e.g., a `.prj` sidecar, RAS Mapper export, or DNR-published reach shapefile) identifying the horizontal datum and projection used to georeference the cross-sections.

**Units sub-check: PASS** — `JTMyers.prj` declares "English Units" (feet). Confirmed.

### Gate 2: Extent vs AOI Comparison

**Status: PENDING — with a caution flag**

**Evidence:**
- The project description states "MILE 846 TO MILE 773."
- The geometry contains 47 cross-sections from RM -777.3 to RM -844.75.
- The upstream-most modeled cross-section is at RM 844.75, which is **1.25 river miles downstream of mile 846**.
- The TSM anchor site (13101 Bonebank Rd, 37.845887, −88.005075) sits at the Ohio–Wabash confluence, approximately at Ohio River mile 846.

**Caution:** The anchor site may lie just **outside** (upstream of) the modeled domain. A format-aware GIS comparison in a common CRS has not been performed to confirm whether the site falls within the modeled reach.

**What would pass:** Overlay of the 47 cross-section locations (georeferenced via DNR reach geometry) against the site AOI in a common verified CRS (e.g., EPSG:2966 or EPSG:4326), with a documented inside/outside determination.

### Gate 3: Boundary Conditions Reviewed

**Status: PENDING**

**Evidence documented (not yet reviewed):**
- Downstream: known water-surface elevations 369.45–370.45 ft NGVD29 (f01, varies by profile).
- Upstream: boundary type 0 — in HEC-RAS 3.x this defaults to normal depth computed from the energy slope, but no slope value or calibration note is recorded in the archive.
- Flow data vintage: 1976 discharges (per project description).
- No calibration report, gage-comparison table, or validation memo is present in the archive.

**What would pass:** A qualified hydraulic reviewer confirms the boundary conditions are appropriate for the intended question, documents the basis (gage record, FIS report tables, or calibration study), and records any limitations (e.g., 1976-vintage flows applied to a 2014-effective FIS).

### Gate 4: Qualified Human Reviewer Approval

**Status: PENDING — prior AI approval WITHDRAWN**

**Evidence:** Commit `3aa0115d` (2026-10-17) withdrew the AI-authored "APPROVED for technical execution" wording. No dated approval from a qualified human hydraulic reviewer (PE or equivalent) is recorded for any intended use of this model.

**What would pass:** A named, dated, scope-limited approval from a qualified hydraulic reviewer, bound to the exact archive hash (`938dd9e5…`) and stating the intended use (e.g., "screening-level floodplain review for parcel X" vs. "regulatory BFE determination").

### Gate 5: Software Compatibility

**Status: PENDING**

**Evidence:**
- Model authored in HEC-RAS 3.11–3.13 (2005–2006).
- HEC-RAS 7.x maintains backward compatibility for steady-flow 1D projects of this era.
- However: the model has no RAS Mapper georeferencing, no terrain association, and uses the legacy encroachment-table format. Modern HEC-RAS will open it, but the 1D cross-section model cannot leverage 2D or terrain-based features without re-georeferencing.
- No execution test has been performed in any HEC-RAS version.

**What would pass:** The model opens without errors in a documented HEC-RAS version (e.g., 6.x), the archived output files (`.O01`, `.O02`) reproduce within tolerance, and any version-migration warnings are dispositioned.

## Vertical Datum (supplementary, not a numbered gate)

**Status: PASS — NGVD29 confirmed**

Direct evidence from `JTMyers.prj` DESCRIPTION block: "1929 DATUM (NGVD)". See `HECRAS-4449-DATUM-FINDING-2026-10-18.md`. This finding corrects the earlier withdrawal's premise but does not reinstate execution approval.

## Summary Table

| Gate | Status | Blocker |
|---|---|---|
| 1. Horizontal CRS verified | **FAIL** | No CRS metadata in archive; geometry in river-station coordinates |
| 2. Extent vs AOI | **PENDING** ⚠️ | Upstream limit RM 844.75 may exclude anchor at mile ~846; no GIS overlay done |
| 3. Boundary conditions reviewed | **PENDING** | Values documented; calibration basis unreviewed |
| 4. Qualified human approval | **PENDING** | Prior AI approval withdrawn; no human review recorded |
| 5. Software compatibility | **PENDING** | Likely compatible; no execution test performed |
| Datum (supplementary) | **PASS** | NGVD29 confirmed from project file |

## Disposition

**BLOCKED.** Model 4449 remains `CANDIDATE_ARCHIVE_ONLY`. No HEC-RAS execution, flood-depth claim, design conclusion, or regulatory determination is authorized.

The most material newly-documented findings from this extraction:
1. **Gate 1 fails** — there is no horizontal CRS to verify; the model predates HEC-RAS GIS integration.
2. **Gate 2 has a real extent concern** — the modeled domain ends at RM 844.75, potentially 1.25 miles downstream of the anchor site.
3. **The model is a floodway/floodplain FIS model** (encroachment analysis + 10%/2%/1%/0.2% profiles), not a general-purpose unsteady model — its intended question was the 2014-effective FIS, not site-specific design.

## References

- `HECRAS-4449-DATUM-FINDING-2026-10-18.md` — NGVD29 confirmation
- `HECRAS-4449-REVIEWER-APPROVAL-2026-10-17.md` — withdrawn AI approval (superseded)
- Archive SHA-256: `938dd9e593f6554b1b7d7095ff11eecc4862bf6c8a6966e88fd6db7f7ff5a7f6`
