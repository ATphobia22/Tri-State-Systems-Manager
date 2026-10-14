# TSM Agricultural Stack

Open-source agricultural mapping tools, datasets, and standards for the
Ohio–Wabash River Valley (Posey County, IN and tri-state region).

All resources below are free and open-source unless noted. No lock-in.

## Datasets (Public Domain / Free)

### USDA NASS Cropland Data Layer (CDL)
- **What:** Annual 30m crop type map, 1997–present. Corn, soybeans, wheat, etc.
- **License:** Public domain (US federal)
- **Access:** https://croplandcros.scinet.usda.gov/ (no account)
- **Script:** `scripts/fetch-usda-cdl.py`
- **Use in TSM:** Crop rotation history, field-level crop identification

### USDA SSURGO Soils
- **What:** Detailed soil survey — map units, components, drainage, hydrologic group
- **License:** Public domain (US federal)
- **Access:** Soil Data Access API (no auth): https://sdmdataaccess.sc.egov.usda.gov/
- **Script:** `scripts/query-ssurgo-soils.py`
- **Use in TSM:** Soil capability, drainage class for flood/field analysis

### USDA NAIP Aerial Imagery
- **What:** 60cm (newer) / 1m aerial orthoimagery, 4-band (RGB+NIR), CONUS
- **License:** Public domain
- **Access:** Microsoft Planetary Computer (anonymous), USDA Gateway
- **Use in TSM:** Field boundaries, crop health (NIR), base imagery

### Sentinel-2 / Landsat
- **What:** 10m/30m multispectral satellite, 5-day / 16-day revisit
- **License:** Free and open (Copernicus / USGS)
- **Access:** Copernicus Data Space, EarthExplorer (free account required)
- **Use in TSM:** NDVI time series, crop vigor monitoring

### IndianaMap
- **What:** Indiana's open geospatial portal — 14 years of NASS crop cover, LiDAR, elevation
- **License:** Open (state)
- **Access:** https://www.indianamap.org/ (anonymous browsing)
- **Use in TSM:** State-specific layers, validation

## Open-Source Tools

### Microsoft FarmVibes.AI
- **What:** Satellite + weather ML pipeline for agriculture. CDL/NAIP/Sentinel downloaders, crop classification, yield prediction.
- **License:** MIT
- **Repo:** https://github.com/microsoft/farmvibes-ai
- **Deploy:** Docker, runs locally
- **Use in TSM:** Remote sensing layer — automated crop health, field analytics

### OpenDroneMap / WebODM
- **What:** Drone photogrammetry — orthomosaics, DSM/DTM, NDVI plant health maps
- **License:** AGPL
- **Repo:** https://github.com/OpenDroneMap/ODM
- **Deploy:** Docker self-host
- **Use in TSM:** High-res field mapping from drone flights

### farmOS
- **What:** Farm records, field mapping, offline mobile app (Field Kit)
- **License:** GPL
- **Site:** https://farmos.org/
- **Use in TSM:** Farm operation records, field history

### AgOpenGPS
- **What:** Autosteer, guidance, rate control — ~1/5 the cost of commercial systems
- **License:** Open source (community hardware)
- **Repo:** https://github.com/AgOpenGPS-Official/AgOpenGPS
- **Use in TSM:** Precision application reference

### QGIS Agricultural Plugins
- **Yield Data Cleaner** — Modernize yield monitor data (github.com/noahdfreeman/yield_data_cleaner)
- **MerginMaps** — Mobile field data collection
- **AI Segmentation** — Field polygon extraction from imagery

## Data Standards

### AgGateway ADAPT
- **What:** Open standard for field operations data (JSON + GeoParquet/GeoTIFF)
- **License:** Free and open
- **Repo:** https://github.com/AgGateway-ADAPT/Standard
- **Use in TSM:** Interoperability with farm equipment and FMIS

### ISOBUS / ISOXML
- **What:** Machine/display compatibility standard
- **Use in TSM:** Variable rate application files

## Integration with TSM

The agricultural layer sits alongside the existing TSM data fabric:

```
Hydrology → Flood → Terrain → Imagery → Parcels → Agriculture → ...
```

Agricultural data follows the same provenance rules:
- Every dataset records source, vintage, CRS, license
- Missing = unavailable, never fabricated
- Public domain preferred; licensed data clearly marked
