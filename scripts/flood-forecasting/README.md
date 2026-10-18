# TSM Flood Forecasting Toolkit

Complete flood forecasting pipeline for the Ohio-Wabash tri-state region.
All scripts share configuration via `tsm_config.py`.

## Quick Start

```bash
# Run the full pipeline
python run_all.py --step all

# Individual steps
python run_all.py --step ingest       # USGS gage data
python run_all.py --step antecedent   # precipitation conditions
python run_all.py --step nowcast      # TimesFM 0-48h
python run_all.py --step forecast     # GEOGloWS 10-day
python run_all.py --step rating       # ras2fim rating curves
python run_all.py --step alert        # flood stage check
```

## Architecture

```
Data Sources          Models              Outputs
─────────────         ──────              ───────
USGS gages     ──┐
NWS NWPS       ──┤
GPM precip     ──┤──→ TimesFM ──→ 0-48h nowcast ──┐
TESSERA        ──┤                                 ├──→ Console flood layer
PRISM normals  ──┤──→ OpenHydroNet ──→ 7-day ─────┤
WeatherNext    ──┘                                 │
GEOGloWS ──────────→ 10-day operational ──────────┘
HEC-RAS ──→ ras2fim ──→ depth rasters + rating curves
```

## Scripts

| Script | Purpose | Source |
|--------|---------|--------|
| `tsm_config.py` | Shared config (gages, bbox, paths) | — |
| `run_all.py` | Master orchestrator | — |
| `tsm_usgs_ingest.py` | USGS gage data via dataretrieval-python | [DOI-USGS/dataretrieval-python](https://github.com/DOI-USGS/dataretrieval-python) |
| `timesfm-gage-nowcast.py` | TimesFM 3.0 zero-shot nowcasting (0-48h) | [ATphobia22/timesfm](https://github.com/ATphobia22/timesfm) |
| `tsm-tristate-openhydronet-config.yml` | OpenHydroNet basin config | [ATphobia22/flood-forecasting](https://github.com/ATphobia22/flood-forecasting) |
| `prepare-static-attributes.py` | Basin attributes (DEM, TESSERA PCs) | — |
| `weathernext-forcing.py` | WeatherNext 2 meteorological forcing | [ATphobia22/weathernext](https://github.com/ATphobia22/weathernext) |
| `geoglows_forecast.py` | GEOGloWS v2 streamflow (10-day) | [ATphobia22/pygeoglows](https://github.com/ATphobia22/pygeoglows) |
| `tessera-tristate-download.py` | TESSERA land embeddings (Icechunk) | [ATphobia22/tessera](https://github.com/ATphobia22/tessera) |
| `antecedent_precip.py` | Antecedent precipitation index | [erdc/Antecedent-Precipitation-Tool](https://github.com/erdc/Antecedent-Precipitation-Tool) |
| `ras2fim_tristate.py` | HEC-RAS → inundation rasters + rating curves | [NOAA-OWP/ras2fim](https://github.com/NOAA-OWP/ras2fim) |
| `tnm_bulk_download.py` | USGS National Map bulk downloads | https://apps.nationalmap.gov/downloader/ |
| `tsm_usgs_lidar_ept.py` | USGS 3DEP LiDAR EPT config | [ATphobia22/usgs-lidar](https://github.com/ATphobia22/usgs-lidar) |
| `earthdata_tristate.py` | NASA Earthdata (GPM, Landsat, Sentinel) | [ATphobia22/earthaccess](https://github.com/ATphobia22/earthaccess) |
| `bfe_ingestion.py` | BFE synthesis: InFRM estBFE query + FIS PDF parsing | https://webapps.usgs.gov/infrm/estbfe/ |

## Gages

| Site | Name | Datum |
|------|------|-------|
| 03381700 | Ohio River at Old Shawneetown, IL | 309.10 ft NAVD88 |
| 03378500 | Wabash River at New Harmony, IN | 353.07 ft NGVD29 |
| MTVI3 | Ohio River at Mount Vernon, IN (NWS) | Flood stage 35.0 ft |

## Data Flow

1. **Ingest**: Pull latest gage heights from USGS NWIS
2. **Antecedent**: Check if conditions are wetter/drier than normal
3. **Nowcast**: TimesFM predicts next 48h from recent gage data (zero-shot, no training)
4. **Forecast**: GEOGloWS provides 10-day operational streamflow
5. **Rating**: ras2fim curves convert discharge → flood depth
6. **Alert**: Compare current/forecast stages to NWS flood thresholds

## Requirements

```bash
# Core
pip install pandas numpy requests

# USGS
pip install dataretrieval

# TimesFM (run on local machine, not this VM)
pip install torch transformers

# TESSERA
pip install icechunk "numcodecs[pcodec]" xarray s3fs pyproj

# GEOGloWS
pip install geoglows

# NASA Earthdata (requires free Earthdata login)
pip install earthaccess
```

## Notes

- **TimesFM** requires PyTorch — run on your local machine, not this VM (proxy blocks large wheels)
- **GEOGloWS** river IDs must be found manually at https://apps.geoglows.org/ (pygeoglows `latlon_to_river` is broken in v2)
- **TESSERA** full tri-state is 130+ GB — use the anchor window (20km) by default
- **ras2fim** requires HEC-RAS execution environment (Windows or Docker)
- **Earthdata** requires free NASA Earthdata login at https://urs.earthdata.nasa.gov/

## License

Scripts are Apache 2.0. Data sources retain their original licenses:
- TESSERA embeddings: CC-BY-SA (share-alike applies to derived products)
- USGS data: Public domain
- OpenHydroNet: Apache 2.0
