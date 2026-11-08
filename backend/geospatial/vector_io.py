"""GeoPandas vector I/O layer for TSM — parcels, boundaries, flood extents.

Thin, explicitly-provisional wrapper over GeoPandas. It is the backend's
standard Python vector layer: read GeoJSON / Shapefile / GeoPackage into
a GeoDataFrame, reproject everything to the TSM working frame
EPSG:2966 (Indiana State Plane West, US ft), validate geometries, write
GeoJSON, and run a parcel-vs-flood-extent spatial join.

Scope
-----
* Read-only inputs from local files. **No network access at runtime** —
  callers supply files that are already on disk with provenance recorded
  by the caller (source, vintage, acquisition method).
* Every output is stamped ``provisional: True``. Vector geometry is
  **not survey-grade by itself and not FEMA-submittable**; it enters a
  FEMA/LOMA evidence package only with a licensed surveyor's sign-off
  and the existing human gate. The same rule covers the survey package
  (``backend/survey/``) — this module does not change it.
* Coordinate convention: planar X = easting, Y = northing, working
  frame EPSG:2966. A source with no CRS is an error, never silently
  assumed to be WGS84 or State Plane.
* Reference elevation for flood work: BFE 369.1 ft NAVD88
  (FEMA FIS 18129CV000A Table 9). Never the superseded 375.0 ft figure.
* Parcel owner identity is never read, joined, or written here. Only
  geometry and non-personal identifier fields (e.g. parcel number)
  are handled.

Dependency
----------
GeoPandas 1.2.0 (BSD-3-Clause, compatible with TSM's Apache-2.0
charter), declared in ``backend/requirements.txt`` as
``geopandas>=1.2,<2``. It pulls Shapely, pyogrio and pyproj (already
present). If GeoPandas is not installed, importing this module still
works, but every function raises a clear ``RuntimeError`` naming the
missing dependency instead of failing obscurely. The stdlib
parcel/flood code in ``backend/geospatial/posey/parcel_flood_join.py``
does not depend on this module and keeps working without GeoPandas.

Provenance
----------
``read_vector`` records provenance in ``gdf.attrs["tsm_provenance"]``
(source file name, SHA-256, source CRS, vintage, read time, and the
provisional marker). Plain GeoJSON output cannot carry that block, so
``write_geojson`` returns the provenance as a dict alongside the file
and callers must keep it with the file (receipt, log, or evidence
record) — the file alone is not self-describing.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:  # GeoPandas is an optional-at-runtime dependency of this module.
    import geopandas as gpd
    import pandas as pd
    from geopandas import GeoDataFrame
    from shapely.validation import explain_validity
except ImportError:  # pragma: no cover - exercised only without GeoPandas
    gpd = None  # type: ignore[assignment]
    pd = None  # type: ignore[assignment]
    GeoDataFrame = None  # type: ignore[assignment]
    explain_validity = None  # type: ignore[assignment]

#: Marker stamped on every result from this module.
PROVISIONAL = True

#: Short advisory notice; results carry this verbatim.
VECTOR_ADVISORY_NOTICE = (
    "PROVISIONAL — advisory vector computation only. Geometry is not "
    "survey-grade by itself and not FEMA-submittable. It requires a "
    "licensed surveyor's sign-off and the human gate before entering "
    "any FEMA/LOMA evidence package."
)

#: Reference flood elevation used by TSM flood work (ft NAVD88).
BFE_FT_NAVD88 = 369.1

#: Working horizontal frame for TSM vector outputs unless stated otherwise.
WORKING_EPSG = 2966
WORKING_CRS = "EPSG:2966"

#: Reader formats supported by read_vector (GeoPandas/pyogrio engines).
SUPPORTED_SUFFIXES = {".geojson", ".json", ".shp", ".gpkg", ".geopackage"}

__all__ = [
    "BFE_FT_NAVD88",
    "PROVISIONAL",
    "SUPPORTED_SUFFIXES",
    "VECTOR_ADVISORY_NOTICE",
    "WORKING_CRS",
    "WORKING_EPSG",
    "join_summary",
    "parcel_flood_join",
    "provenance_report",
    "read_vector",
    "require_geopandas",
    "sha256_file",
    "to_working_crs",
    "validate_geometries",
    "write_geojson",
]


def require_geopandas() -> None:
    """Raise a clear error if GeoPandas is not installed."""
    if gpd is None:
        raise RuntimeError(
            "GeoPandas is required for backend/geospatial/vector_io.py "
            "but is not installed. Install the backend requirements "
            "(geopandas>=1.2,<2) and retry. The stdlib parcel/flood "
            "code in backend/geospatial/posey/parcel_flood_join.py "
            "does not need GeoPandas and is unaffected."
        )


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_file(path: str | Path) -> str:
    """SHA-256 of a file's bytes (streamed, so large files are fine)."""
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _provenance(
    *,
    source_name: str,
    source_sha256: str,
    source_crs: str,
    vintage: str | None,
) -> dict[str, Any]:
    return {
        "source": source_name,
        "sha256": source_sha256,
        "source_crs": source_crs,
        "vintage": vintage,
        "read_at": utc_now_iso(),
        "working_crs": WORKING_CRS,
        "provisional": PROVISIONAL,
        "advisory_notice": VECTOR_ADVISORY_NOTICE,
    }


def to_working_crs(gdf: "GeoDataFrame") -> "GeoDataFrame":
    """Reproject a GeoDataFrame to EPSG:2966.

    A frame with no CRS is an error — the source frame is never
    guessed. A frame already in EPSG:2966 is returned unchanged.
    """
    require_geopandas()
    if gdf.crs is None:
        raise ValueError(
            "input GeoDataFrame has no CRS; the source frame must be "
            "stated explicitly (e.g. EPSG:4326) — it is never assumed"
        )
    if gdf.crs.to_epsg() == WORKING_EPSG:
        return gdf
    return gdf.to_crs(WORKING_CRS)


def read_vector(
    path: str | Path,
    *,
    source: str | None = None,
    vintage: str | None = None,
    layer: str | None = None,
) -> "GeoDataFrame":
    """Read a vector file into a GeoDataFrame in EPSG:2966.

    Supported: GeoJSON (.geojson/.json), Shapefile (.shp),
    GeoPackage (.gpkg). ``source`` names the dataset for provenance
    (defaults to the file name); ``vintage`` is a free-text vintage
    label, e.g. "2020" or "2026-11-07 snapshot". No network access
    is made at any point. Provenance is stored on
    ``gdf.attrs["tsm_provenance"]`` and can be read back with
    ``provenance_report``.
    """
    require_geopandas()
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"vector file not found: {path}")
    if path.suffix.lower() not in SUPPORTED_SUFFIXES:
        raise ValueError(
            f"unsupported vector format {path.suffix!r}; supported: "
            f"{sorted(SUPPORTED_SUFFIXES)}"
        )
    kwargs: dict[str, Any] = {}
    if layer is not None:
        kwargs["layer"] = layer
    gdf = gpd.read_file(path, **kwargs)
    if len(gdf) == 0:
        raise ValueError(f"vector file contains no features: {path}")
    if gdf.crs is None:
        raise ValueError(
            f"vector file {path} declares no CRS; the source frame "
            "must be stated explicitly — it is never assumed"
        )
    source_crs = gdf.crs.to_string()
    gdf = to_working_crs(gdf)
    gdf.attrs["tsm_provenance"] = _provenance(
        source_name=source or path.name,
        source_sha256=sha256_file(path),
        source_crs=source_crs,
        vintage=vintage,
    )
    return gdf


def validate_geometries(gdf: "GeoDataFrame") -> dict[str, Any]:
    """Validate every geometry in a frame; returns a report dict.

    Invalid or empty geometries are listed by row position with the
    reason (``is_valid_reason``), never silently dropped or repaired.
    Repair, if ever needed, is a separate, explicitly recorded step.
    """
    require_geopandas()
    invalid: list[dict[str, Any]] = []
    empty = 0
    for pos, geom in enumerate(gdf.geometry):
        if geom is None or geom.is_empty:
            empty += 1
            invalid.append({"row": pos, "reason": "empty or missing geometry"})
            continue
        if not geom.is_valid:
            # Shapely geometries have no is_valid_reason attribute;
            # the reason comes from shapely.validation.explain_validity
            # (same helper the eight-county validator already uses).
            reason = (
                explain_validity(geom)
                if explain_validity is not None
                else "invalid geometry"
            )
            invalid.append({"row": pos, "reason": str(reason)})
    bounds = gdf.total_bounds.tolist() if len(gdf) else []
    return {
        "status": "OBSERVED" if not invalid else "INVALID_GEOMETRIES",
        "feature_count": int(len(gdf)),
        "valid_count": int(len(gdf) - len(invalid)),
        "invalid_count": len(invalid),
        "empty_count": empty,
        "invalid": invalid,
        "geometry_types": sorted({str(t) for t in gdf.geom_type.unique()}),
        "crs": None if gdf.crs is None else gdf.crs.to_string(),
        "bounds_epsg2966": bounds,
        "provisional": PROVISIONAL,
    }


def write_geojson(gdf: "GeoDataFrame", path: str | Path) -> dict[str, Any]:
    """Write a frame to GeoJSON (EPSG:4326, per the GeoJSON spec).

    The written file carries no provenance block of its own — the
    returned dict (source SHA-256, feature count, CRS, provisional
    marker) must be kept with the file by the caller. The frame is
    reprojected to EPSG:4326 for output; the caller's in-memory frame
    is not modified.
    """
    require_geopandas()
    path = Path(path)
    if gdf.crs is None:
        raise ValueError("cannot write a GeoDataFrame with no CRS")
    out = gdf.to_crs("EPSG:4326")
    out.to_file(path, driver="GeoJSON")
    return {
        "status": "OBSERVED",
        "path": str(path),
        "feature_count": int(len(out)),
        "crs": "EPSG:4326",
        "sha256": sha256_file(path),
        "provisional": PROVISIONAL,
        "advisory_notice": VECTOR_ADVISORY_NOTICE,
    }


def provenance_report(gdf: "GeoDataFrame") -> dict[str, Any]:
    """Return the provenance block recorded by ``read_vector``.

    Returns ``{"status": "UNAVAILABLE", ...}`` (never fabricated)
    when the frame was not produced by ``read_vector``.
    """
    provenance = dict(gdf.attrs.get("tsm_provenance") or {})
    if not provenance:
        return {
            "status": "UNAVAILABLE",
            "reason": "no tsm_provenance recorded on this GeoDataFrame",
        }
    return {"status": "OBSERVED", **provenance}


def parcel_flood_join(
    parcels: "GeoDataFrame",
    flood: "GeoDataFrame",
    *,
    parcel_id_field: str = "parcel_id",
    flood_zone_field: str = "flood_zone",
) -> "GeoDataFrame":
    """Spatial-join parcels against a flood extent (both EPSG:2966).

    Every parcel is kept, whether or not it intersects the flood
    extent: intersecting parcels get ``in_flood_extent=True``,
    the flood zone value, and the overlap area in square feet
    (EPSG:2966 is in US survey feet, so ``.area`` is sq ft);
    non-intersecting parcels get ``in_flood_extent=False``,
    ``flood_zone=None`` and ``overlap_area_sqft=0.0``. Both inputs
    must already be in EPSG:2966 — a frame in another CRS is an
    error, never silently reprojected inside a join, so a frame
    mix-up is visible, not silent. The result carries
    ``provisional: True`` in its attrs.

    This is a local-file vector join only. It does not call the
    live DNR / FEMA services in
    ``backend/geospatial/posey/parcel_flood_join.py`` and it makes
    no flood-zone, BFE, or insurance determination of its own.
    """
    require_geopandas()
    for name, frame in (("parcels", parcels), ("flood", flood)):
        if frame.crs is None or frame.crs.to_epsg() != WORKING_EPSG:
            raise ValueError(
                f"{name} must already be in {WORKING_CRS} (got "
                f"{None if frame.crs is None else frame.crs.to_string()}); "
                "reproject with to_working_crs() before joining"
            )
    if parcel_id_field not in parcels.columns:
        raise ValueError(f"parcels have no {parcel_id_field!r} column")
    if flood_zone_field not in flood.columns:
        raise ValueError(f"flood extent has no {flood_zone_field!r} column")
    if len(flood) == 0:
        joined = parcels.copy()
        joined["in_flood_extent"] = False
        joined["flood_zone"] = None
        joined["overlap_area_sqft"] = 0.0
        joined.attrs["tsm_provenance"] = {
            "operation": "parcel_flood_join",
            "flood_feature_count": 0,
            "provisional": PROVISIONAL,
            "advisory_notice": VECTOR_ADVISORY_NOTICE,
        }
        return joined

    # One row per (parcel, intersecting flood feature), then collapse
    # to one row per parcel keeping the largest overlap.
    raw = gpd.sjoin(
        parcels, flood[[flood_zone_field, "geometry"]], how="left", predicate="intersects"
    )
    rows: list[dict[str, Any]] = []
    for parcel_id, group in raw.groupby(parcel_id_field, sort=False):
        base = group.iloc[0]
        parcel_geom = base.geometry
        parcel_area = float(parcel_geom.area)
        hits = group[group["index_right"].notna()]
        if len(hits) == 0:
            rows.append(
                {
                    **{c: base[c] for c in parcels.columns},
                    "in_flood_extent": False,
                    "flood_zone": None,
                    "overlap_area_sqft": 0.0,
                    "parcel_area_sqft": parcel_area,
                }
            )
            continue
        best_overlap = 0.0
        best_zone: Any = None
        for _, hit in hits.iterrows():
            flood_geom = flood.loc[hit["index_right"], "geometry"]
            overlap = float(parcel_geom.intersection(flood_geom).area)
            if overlap > best_overlap:
                best_overlap = overlap
                best_zone = hit[flood_zone_field]
        # "Intersects" also matches parcels that merely touch the flood
        # boundary along an edge or point (zero overlap area). A parcel
        # is in the flood extent only when the overlap area is > 0.
        in_flood = best_overlap > 0.0
        rows.append(
            {
                **{c: base[c] for c in parcels.columns},
                "in_flood_extent": in_flood,
                "flood_zone": best_zone if in_flood else None,
                "overlap_area_sqft": best_overlap if in_flood else 0.0,
                "parcel_area_sqft": parcel_area,
            }
        )
    result = gpd.GeoDataFrame(rows, geometry="geometry", crs=WORKING_CRS)
    # pandas (3.x) infers a str dtype for the mixed flood_zone column
    # and silently converts None to NaN. Force object dtype so a
    # non-intersecting parcel keeps flood_zone exactly None — callers
    # test `is None`, and a NaN zone would be a silent wrong value.
    result["flood_zone"] = pd.Series(
        [z if f else None for z, f in zip(result["flood_zone"], result["in_flood_extent"])],
        index=result.index,
        dtype=object,
    )
    result.attrs["tsm_provenance"] = {
        "operation": "parcel_flood_join",
        "parcel_count": int(len(parcels)),
        "flood_feature_count": int(len(flood)),
        "in_flood_count": int(result["in_flood_extent"].sum()),
        "provisional": PROVISIONAL,
        "advisory_notice": VECTOR_ADVISORY_NOTICE,
    }
    return result


def join_summary(joined: "GeoDataFrame") -> dict[str, Any]:
    """Count summary of a ``parcel_flood_join`` result."""
    require_geopandas()
    if "in_flood_extent" not in joined.columns:
        raise ValueError("frame is not a parcel_flood_join result")
    return {
        "status": "OBSERVED",
        "parcel_count": int(len(joined)),
        "in_flood_count": int(joined["in_flood_extent"].sum()),
        "outside_count": int((~joined["in_flood_extent"]).sum()),
        "total_overlap_area_sqft": float(joined["overlap_area_sqft"].sum()),
        "provisional": PROVISIONAL,
    }
