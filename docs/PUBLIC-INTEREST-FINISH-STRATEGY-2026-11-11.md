# Finishing TSM: Public-Interest Engineering Strategy

**Date:** 2026-11-11  
**Principle:** Technology informs people; human authority remains final.  
**Core distinction:** Assembling authoritative government evidence ≠ independently validating every engineering conclusion.

## Why this finish line

Ordinary people should not need institutional funding, expensive software, or specialized hardware to **inspect** environmental risk information about their community. TSM integrates publicly funded geospatial, hydrologic, infrastructure, and scientific sources into one inspectable environment.

You do not need to operate Unreal or a Windows workstation continuously for the work to matter. A reproducible architecture, source inventory, transparent methodology, and documented limitations are valuable deliverables on their own.

## Dual completion milestones

### Milestone A — Scientific & public-interest completion
Achievable without a powerful PC:

- [ ] Immutable multi-state source manifest (federal + IN/IL/KY)
- [ ] Public evidence package + machine-readable validation report
- [ ] Documented methods and limitations
- [ ] Honest inventory of missing evidence
- [ ] Independently repeatable tests for contracts that do not require UE

### Milestone B — Production software completion
Requires authorized Windows runner / hardware:

- [ ] UE5.8 Shipping executable via BuildCookRun
- [ ] Offline start on clean Windows 11 (network disabled)
- [ ] Validated terrain + 3D Tiles render
- [ ] Auditable release package (checksums, SBOM, signatures where configured)

**Recommendation:** Finish Milestone A first; close Milestone B without compromising scientific honesty.

## Six workstreams

| # | Workstream | Primary artifacts |
|---|------------|-------------------|
| 1 | Evidence reproducible | `integrations/registry/tsm-immutable-source-manifest-v1.json`, validation report |
| 2 | Building inventory honesty | Match footprints; unknown-height explicit; no fake LOD2 |
| 3 | Real 3D Tiles chain | geometry → GLB → HLOD → tileset.json → offline renderer |
| 4 | Scientific verification chain | NFHL/FIRM/FIS + USGS/NOAA + read-only HEC-RAS HDF5 |
| 5 | Native Windows release | Self-hosted runner, Shipping, offline acceptance |
| 6 | Public-interest record | White paper, methodology, registry, reproducibility guide |

## Official building blocks (do not rebuild)

- **USGS Water Data APIs v1** (2026) + STAC/Parquet — migrate before legacy WaterServices retirement (~early 2027)
- **NOAA NWPS** — observations, forecasts, categories, NWM; never silent substitute for USGS observed
- **USGS 3DEP / LidarExplorer** — terrain and coverage; do not invent heights
- **NOAA NGS GEOID18 / VDatum** — record model, epoch, units, coverage, uncertainty
- **Cesium for Unreal** — local-disk 3D Tiles possible without ion/localhost when assets are valid

## Three distinctive innovations

1. **Evidence Time Machine** — show how source revisions, terrain, datums, and observations changed over time for a place.
2. **Uncertainty Lens** — missing heights, uncalibrated models, datum uncertainty visible in the scene—not hidden by polish.
3. **Community Evidence Passport** — parcel-scoped informational export with sources, dates, and open questions; not a survey or FEMA determination.

## What this does and does not claim

**Can demonstrate:** architecture works; sources authentic; calculations reproducible; uncertainty disclosed; ordinary people can inspect results.  
**Does not claim:** agencies lack concern; TSM has surpassed every engineering platform; LOMA/PE outcomes without licensed process.

Human authority remains final.
