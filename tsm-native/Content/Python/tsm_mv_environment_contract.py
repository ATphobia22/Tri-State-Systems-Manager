"""Source-controlled cinematic environment presets for Mount Vernon (illustrative).

These settings are not live observed weather, river stage, solar irradiance,
traffic conditions, or field measurements. The date and IANA timezone are used
only to compute the correct local UTC offset and DST flag.
"""
from __future__ import annotations

from datetime import datetime
from math import hypot
from zoneinfo import ZoneInfo

TZ = "America/Chicago"
LATITUDE = 37.9323
LONGITUDE = -87.8950
ENVIRONMENT_SCALARS = {
    "SeasonProgress": 0.35,
    "SurfaceWetness": 0.0,
    "RiverMistDensity": 0.25,
}
WIND_XY = (0.85, 0.52)
WIND_DEFAULT_STRENGTH = 0.35
PRESETS = {
    "RiverMist_Dawn": {
        "local": "2026-10-15T06:45:00",
        "season": 0.67, "wetness": 0.25, "wind": 0.10, "mist": 0.8,
    },
    "Summer_HighNoon": {
        "local": "2026-07-12T13:30:00",
        "season": 0.35, "wetness": 0.0, "wind": 0.3, "mist": 0.05,
    },
    "Autumn_GoldenHour": {
        "local": "2026-10-24T17:15:00",
        "season": 0.70, "wetness": 0.1, "wind": 0.2, "mist": 0.2,
    },
    "StormFront_Dusk": {
        "local": "2026-05-18T18:50:00",
        "season": 0.25, "wetness": 0.95, "wind": 0.85, "mist": 0.40,
    },
    "Winter_BlueHour": {
        "local": "2026-01-20T17:25:00",
        "season": 0.95, "wetness": 0.0, "wind": 0.3, "mist": 0.15,
    },
}


def preset(name):
    if name not in PRESETS:
        raise ValueError("Unknown Mount Vernon cinematic preset: " + str(name))
    p = dict(PRESETS[name])
    for key in ("season", "wetness", "wind", "mist"):
        v = p[key]
        if isinstance(v, bool) or not isinstance(v, (float, int)) or not 0 <= v <= 1:
            raise ValueError(name + " has invalid " + key)
    local = datetime.fromisoformat(p["local"]).replace(tzinfo=ZoneInfo(TZ))
    hours = local.utcoffset().total_seconds() / 3600
    # Use IANA DST, not user-supplied constant -6 throughout the year.
    standard_hours = -6.0
    p.update({
        "name": name,
        "time_zone": TZ,
        "local_utc_offset_hours": hours,
        "is_daylight_saving_time": hours != standard_hours,
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "weather_provenance": "CINEMATIC_NOT_OBSERVED",
        "solar_elevation": None,
        "sky_sun_position_ue_verified": False,
    })
    return p


def material_parameters(name):
    p = preset(name)
    norm = hypot(*WIND_XY)
    return {
        "scalar": {
            "SeasonProgress": p["season"],
            "SurfaceWetness": p["wetness"],
            "RiverMistDensity": p["mist"],
        },
        "vector": {
            "WindDirectionAndSpeed": (
                WIND_XY[0] / norm, WIND_XY[1] / norm, 0.0, p["wind"]),
        },
    }
