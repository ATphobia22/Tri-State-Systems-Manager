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
        "lat": 37.6936,
        "lon": -88.1369,
        "datum_ft": 309.10,
        "datum": "NAVD88",
        "params": {
            "stage": "00065",      # gage height, ft
            "discharge": "00060",  # discharge, cfs
        },
    },
    "03378500": {
        "name": "Wabash River at New Harmony, IN",
        "short": "wabash_new_harmony",
        "lat": 38.1289,
        "lon": -87.9361,
        "datum_ft": 353.07,
        "datum": "NGVD29",
        # Dual-datum equivalents per USGS (verified 2026-10-18):
        # - WDR 2005: "353.07 ft NGVD29 (352.67 ft NAVD88)"
        # - WY2025: "352.71 ft NAVD88, 353.07 ft NGVD29" (most current)
        # Local NGVD29->NAVD88 shift: -0.36 to -0.40 ft
        "datum_ngvd29_ft": 353.07,
        "datum_navd88_ft": 352.71,  # per USGS WY2025; 352.67 per WDR 2005/SIR 2016-5119
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
