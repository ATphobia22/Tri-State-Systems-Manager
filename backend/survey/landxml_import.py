"""Read-only LandXML 1.2 import — hand-written, standard library only.

Scope: ``Surfaces`` (TIN points + faces), ``Parcels`` (CoordGeom
lines/curves as read-only geometry), ``CgPoints`` and
``CoordinateSystem``. Nothing else is read, and nothing is written:
there is no LandXML writer in TSM.

Source of truth: the LandXML 1.2 schema at landxml.org
(``http://www.landxml.org/schema/LandXML-1.2/LandXML-1.2.xsd``,
namespace ``http://www.landxml.org/schema/LandXML-1.2``). The
``LandXML-org/LandXML-Schema`` GitHub repository does not exist (404);
do not cite it. The schema documentation confirms the point orders
used here:

* ``CgPoint`` text: northing, easting, optional elevation.
* Surface ``P`` text: northing, easting, elevation.
* ``CoordGeom`` ``Line`` ``Start``/``End`` (PointType): northing,
  easting (optional elevation).
* ``Faces`` ``F`` text: space-delimited list of ``P`` id references.

TSM normalizes everything to (x = easting, y = northing, z) on output
and records the source order in the result, so a northing/easting
swap is visible to a reviewer instead of silent.

Coordinate systems: an EPSG code is only recorded when the
``CoordinateSystem`` element states one explicitly (``name`` or
``desc`` containing ``EPSG:NNNN``). Nothing is guessed from prose.
When a source EPSG is known, :func:`tin_to_geojson` can reproject
face vertices to WGS84 with pyproj; otherwise GeoJSON vertices stay
in the source planar coordinates and the output says so.
"""

from __future__ import annotations

import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

LANDXML_NAMESPACE = "http://www.landxml.org/schema/LandXML-1.2"
LANDXML_XSD = "http://www.landxml.org/schema/LandXML-1.2/LandXML-1.2.xsd"
LANDXML_VERSION = "1.2"

_EPSG_RE = re.compile(r"EPSG[:\s-]?(\d{4,5})", re.IGNORECASE)


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _children(element: ET.Element, name: str) -> list[ET.Element]:
    return [child for child in element if _local(child.tag) == name]


def _first(element: ET.Element, name: str) -> ET.Element | None:
    for child in element:
        if _local(child.tag) == name:
            return child
    return None


def _numbers(text: str | None, *, minimum: int, what: str) -> list[float]:
    if text is None:
        raise ValueError(f"{what} has no coordinate text")
    parts = text.split()
    if len(parts) < minimum:
        raise ValueError(f"{what} needs at least {minimum} numbers, got {parts!r}")
    try:
        values = [float(p) for p in parts]
        if not all(math.isfinite(v) for v in values):
            raise ValueError(f"{what} contains a non-finite coordinate")
        return values
    except ValueError as exc:
        raise ValueError(f"{what} has a non-numeric coordinate: {parts!r}") from exc


def _north_east(text: str | None, what: str) -> tuple[float, float, float | None]:
    """Parse LandXML northing/easting/[elevation] text to (x, y, z)."""
    values = _numbers(text, minimum=2, what=what)
    northing, easting = values[0], values[1]
    z = values[2] if len(values) > 2 else None
    return (easting, northing, z)


def _parse_units(root: ET.Element) -> dict[str, Any]:
    units_el = _first(root, "Units")
    if units_el is None:
        return {"system": None, "linearUnit": None, "areaUnit": None}
    for system in ("Metric", "Imperial"):
        child = _first(units_el, system)
        if child is not None:
            return {
                "system": system,
                "linearUnit": child.attrib.get("linearUnit"),
                "areaUnit": child.attrib.get("areaUnit"),
                "volumeUnit": child.attrib.get("volumeUnit"),
            }
    return {"system": "unknown", "linearUnit": None, "areaUnit": None}


def _parse_coordinate_systems(root: ET.Element) -> list[dict[str, Any]]:
    # LandXML 1.2 has no "CoordinateSystems" container: CoordinateSystem
    # is a direct child of the root, and the EPSG code lives in its
    # epsgCode attribute (e.g. epsgCode="2966"). The name/desc text is
    # only a fallback — an EPSG code is never guessed from prose alone.
    out: list[dict[str, Any]] = []
    for element in _children(root, "CoordinateSystem"):
        name = element.attrib.get("name", "")
        desc = element.attrib.get("desc", "")
        epsg: int | None = None
        epsg_attr = element.attrib.get("epsgCode")
        if epsg_attr is not None and epsg_attr.isdigit():
            epsg = int(epsg_attr)
        else:
            match = _EPSG_RE.search(f"{name} {desc}")
            if match:
                epsg = int(match.group(1))
        out.append(
            {
                "name": name,
                "desc": desc,
                "epsgCode": epsg_attr,
                "horizontalDatum": element.attrib.get("horizontalDatum"),
                "verticalDatum": element.attrib.get("verticalDatum"),
                "epsg": epsg,
            }
        )
    return out


def _parse_cgpoints(root: ET.Element) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for container in root.iter():
        if _local(container.tag) != "CgPoints":
            continue
        for element in _children(container, "CgPoint"):
            x, y, z = _north_east(
                element.text, f"CgPoint {element.attrib.get('name')!r}"
            )
            out.append(
                {
                    "name": element.attrib.get("name"),
                    "oID": element.attrib.get("oID"),
                    "x": x,
                    "y": y,
                    "z": z,
                    "desc": element.attrib.get("desc"),
                    "code": element.attrib.get("code"),
                    "pntSurv": element.attrib.get("pntSurv"),
                    "state": element.attrib.get("state"),
                    "source_order": "northing easting [elevation]",
                }
            )
    return out


def _parse_coord_geom(coord_geom: ET.Element) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = []
    for element in coord_geom:
        kind = _local(element.tag)
        if kind == "Line":
            start_el, end_el = _first(element, "Start"), _first(element, "End")
            if start_el is None or end_el is None:
                raise ValueError("CoordGeom Line is missing Start or End")
            start = _north_east(start_el.text, "CoordGeom Line Start")
            end = _north_east(end_el.text, "CoordGeom Line End")
            segments.append(
                {"type": "Line", "start": start, "end": end}
            )
        elif kind in {"Curve", "Spiral"}:
            # Geometry is preserved as raw attributes + child points;
            # TSM does not (yet) evaluate curve/spiral geometry.
            segments.append(
                {
                    "type": kind,
                    "attributes": dict(element.attrib),
                    "evaluated": False,
                    "note": (
                        f"{kind} geometry is reported, not evaluated — "
                        "parcels containing curves need a surveyor review"
                    ),
                }
            )
        # Other CoordGeom children are ignored and counted by the caller.
    return segments


def _shoelace_area(points_xy: list[tuple[float, float]]) -> float:
    total = 0.0
    for (x1, y1), (x2, y2) in zip(points_xy, points_xy[1:] + points_xy[:1]):
        total += x1 * y2 - x2 * y1
    return abs(total) / 2.0


def _parse_parcels(root: ET.Element) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for container in root.iter():
        if _local(container.tag) != "Parcels":
            continue
        for parcel in _children(container, "Parcel"):
            segments: list[dict[str, Any]] = []
            boundary: list[tuple[float, float]] = []
            for coord_geom in _children(parcel, "CoordGeom"):
                for segment in _parse_coord_geom(coord_geom):
                    segments.append(segment)
                    if segment["type"] == "Line":
                        if not boundary:
                            boundary.append(
                                (segment["start"][0], segment["start"][1])
                            )
                        boundary.append((segment["end"][0], segment["end"][1]))
            declared = parcel.attrib.get("area")
            computed = (
                _shoelace_area(boundary)
                if len(boundary) >= 3 and all(s["type"] == "Line" for s in segments)
                else None
            )
            out.append(
                {
                    "name": parcel.attrib.get("name"),
                    "parcel_class": parcel.attrib.get("class"),
                    "area_declared": None if declared is None else float(declared),
                    "area_computed": computed,
                    "area_unit": None,
                    "segments": segments,
                    "boundary_xy": boundary,
                }
            )
    return out


def _parse_surfaces(root: ET.Element) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for container in root.iter():
        if _local(container.tag) != "Surfaces":
            continue
        for surface in _children(container, "Surface"):
            definition = _first(surface, "Definition")
            points: dict[str, tuple[float, float, float | None]] = {}
            faces: list[list[str]] = []
            surf_type = None
            if definition is not None:
                surf_type = definition.attrib.get("surfType")
                pnts = _first(definition, "Pnts")
                if pnts is not None:
                    for p in _children(pnts, "P"):
                        pid = p.attrib.get("id")
                        if pid is None:
                            raise ValueError("Surface P is missing its id")
                        points[pid] = _north_east(p.text, f"Surface P id={pid!r}")
                faces_el = _first(definition, "Faces")
                if faces_el is not None:
                    for f in _children(faces_el, "F"):
                        faces.append((f.text or "").split())
            out.append(
                {
                    "name": surface.attrib.get("name"),
                    "surfType": surf_type,
                    "points": points,
                    "faces": faces,
                    "point_count": len(points),
                    "face_count": len(faces),
                }
            )
    return out


def parse_landxml(path_or_text: str | Path) -> dict[str, Any]:
    """Parse a LandXML 1.2 document (file path or XML text).

    Returns a dict with ``version``, ``units``, ``coordinate_systems``,
    ``cgpoints``, ``parcels`` and ``surfaces``, plus ``warnings`` for
    anything seen but not interpreted (other sections, non-1.2 version,
    curve/spiral parcel geometry). Raises ``ValueError`` on malformed
    XML, a non-LandXML root, or unreadable coordinates.
    """
    text: str
    if isinstance(path_or_text, Path) or (
        isinstance(path_or_text, str)
        and "\n" not in path_or_text
        and "<" not in path_or_text
    ):
        text = Path(path_or_text).read_text(encoding="utf-8")
    else:
        text = str(path_or_text)
    # A bounded XML parser must reject DTD/entity expansion and oversized inputs.
    if len(text.encode('utf-8')) > 50_000_000:
        raise ValueError('LANDXML_INPUT_TOO_LARGE')
    if re.search(r'<!\s*(?:DOCTYPE|ENTITY)\b', text, re.IGNORECASE):
        raise ValueError('LANDXML_DTD_NOT_ALLOWED')
    try:
        root = ET.fromstring(text)
    except ET.ParseError as exc:
        raise ValueError(f"not well-formed XML: {exc}") from exc
    if _local(root.tag) != "LandXML":
        raise ValueError(f"root element is {_local(root.tag)!r}, not LandXML")

    warnings: list[str] = []
    version = root.attrib.get("version")
    if version is not None and version != LANDXML_VERSION:
        warnings.append(
            f"LandXML version {version!r} — this reader targets {LANDXML_VERSION}"
        )
    namespace = root.tag[1:].split("}", 1)[0] if root.tag.startswith("{") else None
    if namespace is not None and namespace != LANDXML_NAMESPACE:
        warnings.append(f"unexpected LandXML namespace: {namespace!r}")

    known = {
        "Units", "CoordinateSystem", "CgPoints", "Parcels", "Surfaces",
        "Application", "Project",
    }
    for child in root:
        if _local(child.tag) not in known:
            warnings.append(
                f"section {_local(child.tag)!r} present but not read "
                "(read-only scope: Surfaces, Parcels, CgPoints, "
                "CoordinateSystem)"
            )

    units = _parse_units(root)
    parcels = _parse_parcels(root)
    for parcel in parcels:
        parcel["area_unit"] = units.get("areaUnit")
    return {
        "format": "LandXML",
        "version": version,
        "schema": LANDXML_XSD,
        "units": units,
        "coordinate_systems": _parse_coordinate_systems(root),
        "cgpoints": _parse_cgpoints(root),
        "parcels": parcels,
        "surfaces": _parse_surfaces(root),
        "warnings": warnings,
    }


def tin_to_geojson(
    surface: dict[str, Any],
    *,
    to_crs: str | None = None,
    source_epsg: int | None = None,
) -> dict[str, Any]:
    """Convert one parsed TIN surface to a GeoJSON FeatureCollection.

    One Polygon feature per face, vertices as [easting, northing]
    (x, y) in the source planar coordinates, closed rings, with the
    vertex elevations in ``properties.z``. If ``to_crs`` (e.g.
    ``"EPSG:4326"``) and ``source_epsg`` are both given, vertices are
    reprojected with pyproj and the output CRS is recorded; otherwise
    the output is explicitly labelled with its source planar CRS and
    must not be plotted as longitude/latitude.
    """
    transformer = None
    if to_crs is not None:
        if source_epsg is None:
            raise ValueError(
                "to_crs requires source_epsg — the source CRS was not "
                "stated explicitly in the LandXML file"
            )
        from pyproj import Transformer

        transformer = Transformer.from_crs(
            f"EPSG:{source_epsg}", to_crs, always_xy=True
        )

    def project(x: float, y: float) -> list[float]:
        if transformer is None:
            return [x, y]
        lon, lat = transformer.transform(x, y)
        return [float(lon), float(lat)]

    features: list[dict[str, Any]] = []
    points = surface["points"]
    for index, face in enumerate(surface["faces"]):
        ring: list[list[float]] = []
        heights: list[float | None] = []
        for pid in face:
            if pid not in points:
                raise ValueError(
                    f"surface {surface.get('name')!r} face {index} "
                    f"references unknown point id {pid!r}"
                )
            x, y, z = points[pid]
            ring.append(project(x, y))
            heights.append(z)
        if ring and ring[0] != ring[-1]:
            ring.append(ring[0])
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "surface": surface.get("name"),
                    "face_index": index,
                    "z": heights,
                },
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            }
        )
    crs_note = (
        to_crs
        if transformer is not None
        else (
            f"EPSG:{source_epsg} planar (x=easting, y=northing)"
            if source_epsg is not None
            else "source planar coordinates — CRS not stated in file"
        )
    )
    return {
        "type": "FeatureCollection",
        "properties": {
            "surface": surface.get("name"),
            "surfType": surface.get("surfType"),
            "crs_note": crs_note,
            "provisional": True,
        },
        "features": features,
    }


def polygon_area_xy(points_xy: Sequence[tuple[float, float]]) -> float:
    """Shoelace area of a closed (or closable) planar ring."""
    pts = [(float(x), float(y)) for x, y in points_xy]
    if len(pts) < 3:
        raise ValueError("a polygon needs at least three points")
    return _shoelace_area(pts)
