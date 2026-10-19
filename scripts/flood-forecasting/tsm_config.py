"""
TSM Flood Forecasting — Shared Configuration.

Single source of truth for gages, bounding boxes, paths, and constants
used across all scripts in scripts/flood-forecasting/.

Import: from tsm_config import GAGES, TRISTATE_BBOX, ...
"""

from pathlib import Path

# ---------------------------------------------------------------------------
# Tri-state bounding box (all 8 counties)
# IN: Posey, Vanderburgh, Gibson, Warrick
# IL: Gallatin, White
# KY: Henderson, Union
# ---------------------------------------------------------------------------
TRISTATE_BBOX = (-88.7, 37.6, -87.2, 38.5)  # min_lon, min_lat, max_lon, max_lat

# Anchor site (public per owner 2026-09-27 decision)
ANCHOR_LAT = 37.845887
ANCHOR_LON = -88.005075
ANCHOR_UTM_E = 411572   # UTM 16N
ANCHOR_UTM_N = 4189192  # UTM 16N

# ---------------------------------------------------------------------------
# USGS gage registry
# ---------------------------------------------------------------------------
GAGES = {
    "03381700": {
        "name": "Ohio River at Old Shawneetown, IL",
        "short": "ohio_shawneetown",
        "lat": 37.6925,
        "lon": -88.1347222222222,
        "station_altitude_ft_navd88": 309.10,
        "station_altitude_source_uri": "https://waterdata.usgs.gov/monitoring-location/USGS-03381700/",
        "gage_height_vertical_datum": "GAGE_DATUM",
        "gage_zero_navd88_ft": None,
        "params": {
            "stage": "00065",      # gage height, ft
            "discharge": "00060",  # discharge, cfs
        },
    },
    "03378500": {
        "name": "Wabash River at New Harmony, IN",
        "short": "wabash_new_harmony",
        "lat": 38.13089124398878,
        "lon": -87.94141452141561,
        "station_altitude_ft_navd88": 352.71,
        "station_altitude_ft_ngvd29": 353.07,
        "station_altitude_source_uri": "https://waterdata.usgs.gov/monitoring-location/USGS-03378500/",
        "gage_height_vertical_datum": "GAGE_DATUM",
        # USGS SIR 2016-5119 documents a candidate 352.67-ft NAVD88 gage-zero
        # relationship. TSM has not released this conversion because the source
        # product semantics remain under reconciliation; raw stage is not WSE.
        "gage_zero_navd88_ft_candidate": 352.67,
        "gage_zero_conversion_status": "UNVERIFIED_PRODUCT_SEMANTICS",
        "params": {
            "stage": "00065",
            "discharge": "00060",
        },
    },
    "MTVI3": {
        "name": "Ohio River at Mount Vernon, IN (NWS)",
        "short": "ohio_mtvernon",
        "lat": 37.9361,
        "lon": -87.8987,
        "flood_stage_ft": 35.0,
        "source": "NWS NWPS API",
        "params": {},
    },
}

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).parent.parent.parent
FLOOD_DIR = Path(__file__).parent
DATA_DIR = REPO_ROOT / "data" / "fabrics"

OUTPUT_DIRS = {
    "timesfm": FLOOD_DIR / "timesfm-forecasts",
    "geoglows": FLOOD_DIR / "geoglows-forecasts",
    "earthdata": FLOOD_DIR / "earthdata-downloads",
    "tnm": FLOOD_DIR / "tnm-downloads",
    "ras2fim": FLOOD_DIR / "ras2fim-output",
    "tessera": Path.home() / "workspace" / "tessera-tristate",
}

for d in OUTPUT_DIRS.values():
    d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# TESSERA (AWS Open Data)
# ---------------------------------------------------------------------------
TESSERA_BUCKET = "s3://tessera-embeddings"
TESSERA_PREFIX = "v1.1/dclimate.icechunk"
TESSERA_REGION = "us-west-2"
TESSERA_ZONE = "16N"  # UTM zone for tri-state
TESSERA_YEAR = 2025

# ---------------------------------------------------------------------------
# OpenHydroNet basins (custom delineation needed — not in CAMELS)
# ---------------------------------------------------------------------------
BASINS = {
    "ohio_old_shawneetown": {
        "gage": "03381700",
        "outlet_lon": -88.1369,
        "outlet_lat": 37.6936,
    },
    "wabash_new_harmony": {
        "gage": "03378500",
        "outlet_lon": -87.9361,
        "outlet_lat": 38.1289,
    },
    "ohio_mount_vernon": {
        "gage": "MTVI3",
        "outlet_lon": -87.8987,
        "outlet_lat": 37.9361,
    },
}

# ---------------------------------------------------------------------------
# Flood thresholds
# ---------------------------------------------------------------------------
FLOOD_STAGES = {
    "MTVI3": {
        "action_ft": 30.0,
        "flood_ft": 35.0,
        "moderate_ft": 38.0,
        "major_ft": 42.0,
    },
}
