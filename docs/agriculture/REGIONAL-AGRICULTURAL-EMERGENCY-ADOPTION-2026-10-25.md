# Tri-State professional and agricultural interoperability — 2026-10-25

**Status:** authoritative source research + source-discovery catalog, offline tests,
USDA soil import and county raster clipping. Not a certified professional survey,
not a licensed hydraulic design, not a real farm or flood-loss determination.

## Professional disciplines and data contracts

| Role | Primary authoritative resources | TSM implementation pattern | Release acceptance |
|---|---|---|---|
| Land surveyor | [NGS OPUS](https://geodesy.noaa.gov/OPUS/), [USGS Lidar Base Specification 2025 rev A](https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-online), [Indiana GIO elevation](https://elevation.gio.in.gov/), [Indiana survey licensing](https://www.in.gov/pla/professions/surveyors-home/) | Source LAS/LAZ/COG/GPKG and independent checkpoint receipts with datum, epoch, units, NVA/VVA class | Real survey points and ground-control report, ASPRS/3DEP independent vertical accuracy evaluation by responsible professional |
| Hydraulic engineer | [USACE HEC software](https://www.hec.usace.army.mil/software/), [Indiana DNR State Engineering Resources](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/state-engineering-resources/), [FEMA NFHL](https://www.fema.gov/flood-maps/national-flood-hazard-layer), [ras-commander](https://github.com/gpt-cmdr/ras-commander) | Versioned model packages, base/proposed simulation hashes, datum/flow/stage metadata, scenario reproducibility and independent output review | Complete correct hydraulic model, independent calibration and legally appropriate engineer/FPA review; never derive automatic no-rise or permits |
| Emergency manager | [Indiana DHS](https://www.in.gov/dhs/emergency-management-and-preparedness/), [USGS OGC water APIs](https://api.waterdata.usgs.gov/docs/ogcapi/), [NOAA NWPS](https://api.water.noaa.gov/about/api) | Incident feed freshness flags, NWS alert provenance, gage rating and gage datum; official vs model-derived forecasts distinctly labeled | Agency-approved thresholds, communications exercises and human decisions; no autonomous evacuation orders |
| Farmer/extension | [USDA NRCS SDA](https://sdmdataaccess.sc.egov.usda.gov/WebServiceHelp.aspx), [USDA NASS developer APIs](https://www.nass.usda.gov/developer/), [Purdue flood/crop guidance](https://agry.purdue.edu/Ext/corn/cafe/flood/index.html) | Private opt-in field geometries, source-typed soils/landcover, agricultural weather and flood-impact screening | Source crop year and mapunit vintage, third-party verification, never assign a public field owner a predicted yield or indemnity determination |

Indiana GIO's new QL1 lidar procurement does **not** imply that 2027 Posey County
data or survey control has already been delivered. The USGS Lidar Base
Specification 2025 rev A requires actual lidar mapping reports, survey
checkpoints and vertical accuracy materials. The independent engineering
precheck at `scripts/engineering/independent_acceptance_gate.py` cannot sign
those reports.

## Agricultural source systems: adoption and license gate

- **Immediate government data (no speculative copy):** USDA NRCS Soil Data
  Access (map units, components, horizons), NASS annual Cropland Data Layer
  (categorical 30 m crop mapping), NASS Quick Stats (county agricultural
  estimates; API credential required), NASS flood-impact *historical*
  analysis, gNATSGO and USGS/NOAA drought and gage data.
- **Watershed/crop model evaluation:** [SWAT+](https://github.com/swat-model/swatplus)
  (LGPL), [pySWATPlus](https://github.com/swat-model/pySWATPlus),
  [DSSAT-CMS](https://github.com/DSSAT/dssat-csm-os) (BSD-3-Clause),
  [FarmVibes.AI](https://github.com/microsoft/farmvibes-ai) (MIT, already
  source-present in TSM), and [GRASS GIS](https://github.com/OSGeo/grass)
  (GPL). All demand source/simulator version locks and independently
  calibrated test cases before physical prediction claims.
- **Farm privacy/equipment GIS:** [farmOS](https://github.com/farmOS/farmOS)
  (GPL-2), [OpenDroneMap](https://github.com/OpenDroneMap/ODM) (AGPL),
  [QGIS](https://github.com/qgis/QGIS) (GPL), [AgOpenGPS](https://github.com/AgOpenGPS-Official/AgOpenGPS)
  (WinForms maintenance mode announced April 2026). Do not deploy control
  systems into an autonomous equipment safety loop.
- **Research only until licensing resolved:** [APSIM Next Generation](https://github.com/APSIMInitiative/ApsimX)
  (custom licensing); source access is not a distribution grant.

The new registry at `data/registries/tsm-cross-sector-source-catalog-v1.json`
is **CATALOG_ONLY**. It cannot assert remote acquisition, full production
deployment, instrument observations or agency consent.

## Corrected USDA data ingestion

### NRCS Soil Data Access

The old client queried a non-existent `mapunit.areasymbol` relationship. The
bounded replacement joins `legend.lkey → mapunit.lkey` and `mapunit.mukey →
component.mukey`, verifies `JSON+COLUMNNAME` headers, rejects truncated
row-cap inventories, and persists original response bytes and SHA-256 hashes.
It never accesses the network without `--live`. Queries are limited to
the fixed survey-area pattern `IN129`; source absence produces a nonzero
exit, not fake soil categories.

```bash
python tools/agriculture/scripts/query-ssurgo-soils.py --live \
  --areasymbol IN129 --out private-data/posey-ssurgo.json
# replay using the exact raw snapshots captured in that directory:
python tools/agriculture/scripts/query-ssurgo-soils.py \
  --offline-mapunits private-data/<snapshot.mapunits.raw.json> \
  --offline-components private-data/<snapshot.components.raw.json> \
  --out private-data/posey-ssurgo-replay.json
```

**Caution:** soil horizon depths are depths below ground, not
NAVD88 orthometric elevations; hydrologic soil group and drainage class
are map-unit interpretations, not site borings.

### NASS CDL raster

The previous fetcher claimed it clipped Posey County but downloaded a
whole source GeoTIFF. The replacement only accepts a known HTTPS raster
asset from the Planetary Computer STAC collection `usda-cdl`,
verifies annual identity, checks the official county polygon's
`GEOID=18129`, and uses rasterio mask to **actually crop by polygon**.
The categorical values are never bilinearly resampled. It emits a
raster SHA-256 and a separate source/boundary receipt.

```bash
python tools/agriculture/scripts/fetch-usda-cdl.py --live \
  --year 2025 --out private-data/posey-cdl-2025.tif
```

**Caution:** 30m CDL crop classifications have edge and accuracy limits;
a raster pixel does not establish a farmer's planting, crop-loss or
insurance status. Source crop year must match the STAC collection record.
If the annual product has not been published or the remote host fails,
leave the result unavailable.

## Engineering gating and release practice

```bash
python -m unittest discover -s tools/agriculture/scripts -p 'test_*.py' -v
python tools/agriculture/scripts/validate_source_catalog.py
python -m unittest scripts.engineering.test_independent_acceptance_gate -v
```

`agriculture-evidence.yml` runs on relevant changes and is read-only.
No remote farm data is silently fetched during public builds. Model
confidence, provenance and exact component/epoch/model binding must be
shown in the public console; official government data must not be
mislabelled as survey-grade or as regulatory approval.

The full county-wide Transvoxel and building completeness work, independent
survey checkpoints and calibrated HEC-RAS model comparison are **still
pending real source data, licensed responsible humans, and measured validation**.
The Windows UE5.8 Shipping release requires its separate compiled
artifact and offline hardware acceptance.
