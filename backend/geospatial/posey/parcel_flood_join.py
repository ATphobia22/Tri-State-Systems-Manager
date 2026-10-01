"""Posey County parcel -> floodplain -> terrain spatial join.

Chain:
    XSoft parcel number
        -> StateCombi normalization
        -> real ArcGIS parcel polygon (EPSG:4326)
        -> polygon INTERSECTS
               |- Indiana DNR Best Available Flood Hazard (fail-closed)
               |- FEMA NFHL FIRM Panels (fail-closed; never fabricated)
        -> parcel centroid
        -> USGS 3DEP elevation (EPQS)
        -> engineering evidence object

Fail-closed contract:
  * every source step returns {"status": "OBSERVED"|"UNAVAILABLE"|"NOT_CONFIGURED", ...}
  * UNAVAILABLE never becomes a regulatory or engineering conclusion
  * no BFE, flood insurance, or HEC-RAS conclusion is produced here
  * parcel owner identity fields are never requested from the parcel service

Stdlib only (urllib). No live calls are made at import time.
"""

from __future__ import annotations

import json
import math
import urllib.parse
import urllib.request
from datetime import datetime, timezone

XSOFT_PARCEL_FEATURESERVER = (
    "https://services6.arcgis.com/y6TIO0vqbm8Ixd4w/ArcGIS/rest/services/"
    "Posey_Parcels_(Public)/FeatureServer"
)
# Non-personal identifier/geometry fields only. Owner name/address fields
# (taxOwnerNa, taxOwnerAd, ...) are deliberately never requested.
PARCEL_OUT_FIELDS = "StateCombi,Parcel,ParcelID,CALC_ACRES,Section,Township,Range"

DNR_BAFL_FEATURESERVER = (
    "https://gisdata.in.gov/server/rest/services/"
    "Hosted/FLOODHAZARD_DNR_WATER_PROD/FeatureServer"
)
DNR_BAFL_OUT_FIELDS = (
    "dfirm_id,fld_zone,zone_subty,sfha_tf,source_dnr,source_cit,"
    "static_bfe,depth,velocity,objectid"
)

FEMA_NFHL_MAPSERVER = (
    "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer"
)

EPQS_URL = "https://epqs.nationalmap.gov/v1/json"
# USGS EPQS returns orthometric heights on NAVD88, interpolated from the
# 3DEP dynamic elevation service; accuracy varies with source data.
EPQS_VERTICAL_DATUM = (
    "NAVD88 (USGS EPQS documented orthometric datum; value interpolated "
    "from the 3DEP dynamic elevation service - accuracy varies with source data)"
)

_REQUEST_TIMEOUT_S = 40


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _http_get_json(url: str, timeout: int = _REQUEST_TIMEOUT_S) -> dict | None:
    """GET a JSON endpoint. Returns None on any failure (fail-closed)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "TSM-parcel-flood-join/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status != 200:
                return None
            return json.load(resp)
    except Exception:
        return None


def normalize_state_combi(parcel_number: str) -> str:
    """Normalize an XSoft parcel number to its StateCombi form.

    XSoft's map JS queries ``StateCombi = '<id>'`` where <id> is the parcel
    number with formatting characters removed, e.g.
    ``65-27-08-130-051.600-018`` -> ``652708130051600018``.
    """
    return "".join(ch for ch in parcel_number if ch.isdigit())


def fetch_parcel_polygon(state_combi: str) -> dict:
    """Fetch the real parcel polygon from the XSoft ArcGIS backend.

    Returns {"status": "OBSERVED", "attributes": {...}, "rings": [...]} on
    success, {"status": "UNAVAILABLE", "reason": ...} otherwise.
    """
    where = "StateCombi = '%s'" % state_combi.replace("'", "")
    params = {
        "where": where,
        "outFields": PARCEL_OUT_FIELDS,
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "json",
    }
    url = XSOFT_PARCEL_FEATURESERVER + "/0/query?" + urllib.parse.urlencode(params)
    data = _http_get_json(url)
    if not data or not data.get("features"):
        return {
            "status": "UNAVAILABLE",
            "reason": "parcel service returned no feature for StateCombi",
            "service": XSOFT_PARCEL_FEATURESERVER,
        }
    feature = data["features"][0]
    geometry = feature.get("geometry") or {}
    rings = geometry.get("rings") or []
    if not rings:
        return {
            "status": "UNAVAILABLE",
            "reason": "parcel feature has no polygon geometry",
            "service": XSOFT_PARCEL_FEATURESERVER,
        }
    return {
        "status": "OBSERVED",
        "service": XSOFT_PARCEL_FEATURESERVER + "/0",
        "identifier_field": "StateCombi",
        "state_combi": state_combi,
        "attributes": feature.get("attributes") or {},
        "rings": rings,
        "crs": "EPSG:4326",
        "retrieved_at": utc_now_iso(),
    }


def polygon_centroid(rings: list) -> tuple[float, float]:
    """Area-weighted planar centroid of the outer ring (lon, lat)."""
    outer = rings[0]
    area2 = 0.0
    cx = 0.0
    cy = 0.0
    n = len(outer)
    for i in range(n):
        x0, y0 = outer[i][0], outer[i][1]
        x1, y1 = outer[(i + 1) % n][0], outer[(i + 1) % n][1]
        cross = x0 * y1 - x1 * y0
        area2 += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if area2 == 0:
        xs = [p[0] for p in outer]
        ys = [p[1] for p in outer]
        return (sum(xs) / len(xs), sum(ys) / len(ys))
    area = area2 / 2.0
    return (cx / (6.0 * area), cy / (6.0 * area))


def dnr_flood_join(lon: float, lat: float) -> dict:
    """INTERSECTS the parcel centroid against Indiana DNR Best Available
    Flood Hazard. Returns the joined feature attributes or UNAVAILABLE."""
    geometry = json.dumps({"x": lon, "y": lat, "spatialReference": {"wkid": 4326}})
    params = {
        "geometry": geometry,
        "geometryType": "esriGeometryPoint",
        "spatialRel": "esriSpatialRelIntersects",
        "inSR": "4326",
        "outSR": "4326",
        "outFields": DNR_BAFL_OUT_FIELDS,
        "returnGeometry": "false",
        "f": "json",
    }
    url = DNR_BAFL_FEATURESERVER + "/0/query?" + urllib.parse.urlencode(params)
    data = _http_get_json(url)
    if not data or not data.get("features"):
        return {
            "status": "UNAVAILABLE",
            "reason": "DNR flood-hazard service returned no intersecting feature",
            "service": DNR_BAFL_FEATURESERVER + "/0",
        }
    attrs = data["features"][0].get("attributes") or {}
    return {
        "status": "OBSERVED",
        "service": DNR_BAFL_FEATURESERVER + "/0",
        "dfirm_id": attrs.get("dfirm_id"),
        "flood_zone": attrs.get("fld_zone"),
        "zone_subtype": attrs.get("zone_subty"),
        "sfha": attrs.get("sfha_tf"),
        "dnr_source": attrs.get("source_dnr"),
        "source_citation": attrs.get("source_cit"),
        "static_bfe": attrs.get("static_bfe"),
        "depth": attrs.get("depth"),
        "velocity": attrs.get("velocity"),
        "retrieved_at": utc_now_iso(),
        "authority_note": (
            "DNR Best Available mapping is a state product; the joined feature "
            "identifies its own source (source_dnr). It is not the FEMA NFIP "
            "regulatory product and does not establish a FIRM panel for the parcel."
        ),
    }


def _normalize_fema_date(value: object) -> str | None:
    """Normalize ArcGIS epoch-millisecond dates to an ISO-8601 UTC date."""
    if value in (None, ""):
        return None
    try:
        millis = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(millis):
        return None
    try:
        return datetime.fromtimestamp(millis / 1000.0, timezone.utc).date().isoformat()
    except (OverflowError, OSError, ValueError):
        return None


def nfhl_firm_panel(
    lon: float,
    lat: float,
    rings: list | None = None,
) -> dict:
    """Intersect a parcel point/polygon with FEMA NFHL FIRM Panels.

    Layer 3 is FEMA's S_FIRM_PAN panel index. A parcel polygon is used
    when available so parcels crossing a panel boundary return every
    intersecting panel rather than silently selecting the centroid panel.

    Fail-closed: transport failures and malformed responses are UNAVAILABLE;
    a successful zero-feature query is OBSERVED with mapped=False and
    never becomes a flood-risk or insurance conclusion.
    """
    if rings:
        geometry = json.dumps(
            {"rings": rings, "spatialReference": {"wkid": 4326}},
            separators=(",", ":"),
        )
        geometry_type = "esriGeometryPolygon"
    else:
        geometry = json.dumps(
            {"x": lon, "y": lat, "spatialReference": {"wkid": 4326}},
            separators=(",", ":"),
        )
        geometry_type = "esriGeometryPoint"

    params = {
        "geometry": geometry,
        "geometryType": geometry_type,
        "spatialRel": "esriSpatialRelIntersects",
        "inSR": "4326",
        "outSR": "4326",
        "outFields": (
            "DFIRM_ID,FIRM_ID,ST_FIPS,PCOMM,PANEL,SUFFIX,FIRM_PAN,"
            "PANEL_TYP,PRE_DATE,EFF_DATE,SCALE,PNP_REASON,BASE_TYP,SOURCE_CIT"
        ),
        "returnGeometry": "false",
        "resultRecordCount": "100",
        "f": "json",
    }
    url = FEMA_NFHL_MAPSERVER + "/3/query?" + urllib.parse.urlencode(params)
    data = _http_get_json(url)
    if not isinstance(data, dict):
        return {
            "status": "UNAVAILABLE",
            "reason": (
                "FEMA NFHL FIRM-panel query failed; parcel-specific panel "
                "information was not determined and was not fabricated"
            ),
            "service": FEMA_NFHL_MAPSERVER + "/3",
        }

    if data.get("error"):
        return {
            "status": "UNAVAILABLE",
            "reason": "FEMA NFHL FIRM-panel service returned an ArcGIS error",
            "service": FEMA_NFHL_MAPSERVER + "/3",
        }

    features = data.get("features")
    if not isinstance(features, list):
        return {
            "status": "UNAVAILABLE",
            "reason": "FEMA NFHL FIRM-panel response did not contain a feature list",
            "service": FEMA_NFHL_MAPSERVER + "/3",
        }

    panels: list[dict] = []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        attrs = feature.get("attributes")
        if not isinstance(attrs, dict):
            continue
        panels.append(
            {
                "dfirm_id": attrs.get("DFIRM_ID"),
                "firm_id": attrs.get("FIRM_ID"),
                "state_fips": attrs.get("ST_FIPS"),
                "community_id": attrs.get("PCOMM"),
                "panel": attrs.get("PANEL"),
                "suffix": attrs.get("SUFFIX"),
                "firm_panel": attrs.get("FIRM_PAN"),
                "panel_type": attrs.get("PANEL_TYP"),
                "preliminary_date": _normalize_fema_date(attrs.get("PRE_DATE")),
                "effective_date": _normalize_fema_date(attrs.get("EFF_DATE")),
                "scale": attrs.get("SCALE"),
                "panel_not_printed_reason": attrs.get("PNP_REASON"),
                "base_type": attrs.get("BASE_TYP"),
                "source_citation": attrs.get("SOURCE_CIT"),
            }
        )

    unique: dict[tuple[object, object, object], dict] = {}
    for panel in panels:
        key = (panel.get("dfirm_id"), panel.get("firm_panel"), panel.get("effective_date"))
        unique[key] = panel
    panels = list(unique.values())

    return {
        "status": "OBSERVED",
        "service": FEMA_NFHL_MAPSERVER + "/3",
        "layer_id": 3,
        "layer_name": "S_FIRM_PAN",
        "query_geometry": "polygon" if rings else "point",
        "mapped": bool(panels),
        "panel_count": len(panels),
        "panels": panels,
        "retrieved_at": utc_now_iso(),
        "authority_note": (
            "FEMA NFHL S_FIRM_PAN is the effective FIRM panel index. "
            "Intersection identifies mapped panel coverage only; it does "
            "not by itself establish flood zone, BFE, insurance eligibility, "
            "or a regulatory determination."
        ),
    }


def epqs_elevation(lon: float, lat: float) -> dict:
    """Sample USGS 3DEP elevation at a point via the EPQS v1 API."""
    params = {"x": repr(lon), "y": repr(lat), "units": "Meters"}
    url = EPQS_URL + "?" + urllib.parse.urlencode(params)
    data = _http_get_json(url)
    if not data or data.get("value") in (None, ""):
        return {
            "status": "UNAVAILABLE",
            "reason": "USGS EPQS returned no elevation value",
            "service": EPQS_URL,
        }
    try:
        elevation_m = float(data["value"])
    except (TypeError, ValueError):
        return {
            "status": "UNAVAILABLE",
            "reason": "USGS EPQS returned a non-numeric elevation value",
            "service": EPQS_URL,
        }
    return {
        "status": "OBSERVED",
        "service": EPQS_URL,
        "elevation_m": elevation_m,
        "elevation_ft": elevation_m * 3.28084,
        "vertical_datum": EPQS_VERTICAL_DATUM,
        "raster_id": data.get("rasterId"),
        "resolution_m": data.get("resolution"),
        "retrieved_at": utc_now_iso(),
    }


def build_parcel_flood_evidence(parcel_number: str) -> dict:
    """Run the full parcel -> floodplain -> terrain chain, fail-closed.

    Returns an engineering evidence object. Regulatory and hydraulic
    conclusions are explicitly out of scope for this object.
    """
    evidence: dict = {
        "schema": "tsm.posey.parcel-flood-join/v1",
        "parcel_number_input": parcel_number,
        "state_combi": normalize_state_combi(parcel_number),
        "built_at": utc_now_iso(),
        "scope": (
            "Source observations only. No BFE determination, no flood-insurance "
            "conclusion, no HEC-RAS result, and no engineering certification is "
            "produced or implied by this object."
        ),
    }

    parcel = fetch_parcel_polygon(evidence["state_combi"])
    evidence["parcel_polygon"] = parcel
    if parcel["status"] != "OBSERVED":
        evidence["centroid"] = {"status": "UNAVAILABLE", "reason": "no parcel polygon"}
        evidence["dnr_flood_join"] = {"status": "UNAVAILABLE", "reason": "no parcel polygon"}
        evidence["nfhl_firm_panel"] = {"status": "UNAVAILABLE", "reason": "no parcel polygon"}
        evidence["terrain_3dep"] = {"status": "UNAVAILABLE", "reason": "no parcel polygon"}
        return evidence

    lon, lat = polygon_centroid(parcel["rings"])
    evidence["centroid"] = {
        "status": "OBSERVED",
        "lon": lon,
        "lat": lat,
        "method": "area-weighted planar centroid of parcel outer ring",
        "crs": "EPSG:4326",
    }
    evidence["dnr_flood_join"] = dnr_flood_join(lon, lat)
    evidence["nfhl_firm_panel"] = nfhl_firm_panel(lon, lat, parcel["rings"])
    evidence["terrain_3dep"] = epqs_elevation(lon, lat)
    return evidence


if __name__ == "__main__":
    import sys

    target = sys.argv[1] if len(sys.argv) > 1 else "65-27-08-130-051.600-018"
    print(json.dumps(build_parcel_flood_evidence(target), indent=2))
