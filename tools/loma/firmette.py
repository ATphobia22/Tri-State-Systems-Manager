#!/usr/bin/env python3
"""Generate an annotated FIRMette-style evidence package for a parcel.

This tool assembles an annotated illustration package from operator-supplied
inputs (parcel polygon, parcel ID / address, BFE, owner label, annotation
text). It attempts to retrieve the FEMA FIRM panel image for the parcel
location as the base map. In offline/CI environments (no network) it FAILS
CLOSED: the package is still produced, but the base-map panel carries a
clear "BASE MAP UNAVAILABLE — OFFLINE" watermark. It never fabricates a map
and never silently omits the gap.

The output is not a FEMA determination, LOMA/LOMC decision, survey
certification, or engineering certification. Human review is required before
any use.

Output: PDF when `reportlab` is importable, otherwise a structured,
self-contained HTML document. A JSON manifest with SHA-256 digests of every
artifact, the input parameters, provenance labels, and renderer info is
always written.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence
from urllib.parse import urlencode
from urllib.request import Request, urlopen

# FEMA National Flood Hazard Layer public REST export endpoint. Best-effort
# retrieval only; any failure (network, HTTP, content type) fails closed to
# the watermarked offline placeholder.
NFHL_EXPORT_URL = (
    "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/export"
)

BASE_MAP_UNAVAILABLE_MARK = "BASE MAP UNAVAILABLE — OFFLINE"

SCHEMA_VERSION = "tsm-firmette-v1"
PACKAGE_STATUS = "DRAFT_ANNOTATION_HUMAN_REVIEW_REQUIRED"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _reportlab_available() -> bool:
    try:
        return importlib.util.find_spec("reportlab") is not None
    except Exception:
        return False


def validate_inputs(
    polygon: Sequence[Sequence[float]],
    parcel_id: object,
    address: object,
    bfe_ft: object,
) -> tuple[list[list[float]], str, str, float]:
    """Validate fail-closed inputs. Raises ValueError on any invalid input."""
    if not isinstance(polygon, (list, tuple)) or len(polygon) < 3:
        raise ValueError(
            f"parcel polygon must contain at least 3 [lon, lat] points, "
            f"got {len(polygon) if isinstance(polygon, (list, tuple)) else type(polygon).__name__}"
        )
    points: list[list[float]] = []
    for i, pt in enumerate(polygon):
        if not isinstance(pt, (list, tuple)) or len(pt) != 2:
            raise ValueError(f"polygon point {i} must be a [lon, lat] pair, got {pt!r}")
        lon, lat = pt
        if (
            isinstance(lon, bool)
            or isinstance(lat, bool)
            or not isinstance(lon, (int, float))
            or not isinstance(lat, (int, float))
            or not math.isfinite(lon)
            or not math.isfinite(lat)
        ):
            raise ValueError(
                f"polygon point {i} has non-finite or non-numeric coordinates: {pt!r}"
            )
        points.append([float(lon), float(lat)])

    if not isinstance(parcel_id, str) or not parcel_id.strip():
        raise ValueError("parcel_id is required and must be a non-empty string")
    if not isinstance(address, str) or not address.strip():
        raise ValueError("address is required and must be a non-empty string")
    if (
        isinstance(bfe_ft, bool)
        or not isinstance(bfe_ft, (int, float))
        or not math.isfinite(bfe_ft)
    ):
        raise ValueError(
            f"bfe_ft (BFE in feet NAVD88) is required and must be a finite number, got {bfe_ft!r}"
        )
    return points, parcel_id.strip(), address.strip(), float(bfe_ft)


def padded_bbox(points: list[list[float]], pad: float = 0.25) -> tuple[float, float, float, float]:
    lons = [p[0] for p in points]
    lats = [p[1] for p in points]
    dx = max(max(lons) - min(lons), 1e-9)
    dy = max(max(lats) - min(lats), 1e-9)
    return (
        min(lons) - dx * pad,
        min(lats) - dy * pad,
        max(lons) + dx * pad,
        max(lats) + dy * pad,
    )


def fetch_firm_panel_image(bbox: tuple[float, float, float, float], timeout_s: float = 8.0) -> bytes:
    """Best-effort retrieval of the FIRM panel image. Raises on any failure."""
    xmin, ymin, xmax, ymax = bbox
    params = urlencode(
        {
            "bbox": f"{xmin},{ymin},{xmax},{ymax}",
            "bboxSR": "4326",
            "size": "1024,768",
            "format": "png32",
            "transparent": "false",
            "f": "image",
        }
    )
    req = Request(NFHL_EXPORT_URL + "?" + params, headers={"User-Agent": "tsm-firmette/1.0"})
    with urlopen(req, timeout=timeout_s) as resp:  # noqa: S310
        content_type = resp.headers.get("Content-Type", "")
        if resp.status != 200 or "image" not in content_type:
            raise RuntimeError(
                f"FIRM panel retrieval failed: HTTP {resp.status}, content-type {content_type!r}"
            )
        return resp.read()


def _project(points, bbox, width, height):
    xmin, ymin, xmax, ymax = bbox
    sx = width / (xmax - xmin)
    sy = height / (ymax - ymin)
    return [((lon - xmin) * sx, (ymax - lat) * sy) for lon, lat in points]


def render_panel_svg(
    points: list[list[float]],
    bbox: tuple[float, float, float, float],
    base_map_available: bool,
    width: int = 800,
    height: int = 600,
) -> str:
    """SVG map panel: parcel polygon overlay, north arrow, scale disclaimer.

    When the base map could not be retrieved, the panel is a placeholder
    watermarked with BASE_MAP_UNAVAILABLE_MARK (fail-closed, never fabricated).
    """
    projected = _project(points, bbox, width, height)
    poly_pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in projected)

    background = (
        '<rect x="0" y="0" width="800" height="600" fill="#e8e4d8"/>'
        if not base_map_available
        else '<rect x="0" y="0" width="800" height="600" fill="#dfe8dd"/>'
    )
    watermark = ""
    if not base_map_available:
        lines = []
        for yy in range(70, height, 110):
            lines.append(
                f'<text x="{width / 2}" y="{yy}" text-anchor="middle" '
                f'transform="rotate(-24 {width / 2} {yy})" '
                f'font-family="Helvetica, Arial, sans-serif" font-size="34" '
                f'font-weight="bold" fill="#8a8a8a" opacity="0.55">'
                f"{BASE_MAP_UNAVAILABLE_MARK}</text>"
            )
        watermark = "\n      ".join(lines)

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" role="img" aria-label="FIRMette-style parcel panel">
      <rect x="0" y="0" width="{width}" height="{height}" fill="#ffffff" stroke="#333" stroke-width="2"/>
      {background}
      {watermark}
      <polygon points="{poly_pts}" fill="rgba(30, 120, 200, 0.18)" stroke="#1e4fa3" stroke-width="3"/>
      <g transform="translate({width - 60}, 46)">
        <polygon points="0,-26 10,8 0,2 -10,8" fill="#222"/>
        <text x="0" y="26" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="bold" fill="#222">N</text>
      </g>
      <text x="12" y="{height - 34}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#333">Schematic rendering — not to scale.</text>
      <text x="12" y="{height - 14}" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#333">Verify parcel location and flood hazard against the effective FIRM at FEMA Map Service Center (msc.fema.gov).</text>
    </svg>"""
    return svg


def build_html(
    *,
    parcel_id: str,
    address: str,
    owner_label: str,
    bfe_ft: float,
    annotation: str,
    points: list[list[float]],
    bbox: tuple[float, float, float, float],
    base_map_available: bool,
    generated_utc: str,
    base_map_png: bytes | None,
) -> str:
    panel_svg = render_panel_svg(points, bbox, base_map_available)
    base_map_note = (
        "Retrieved from FEMA National Flood Hazard Layer (public REST export)."
        if base_map_available
        else f"{BASE_MAP_UNAVAILABLE_MARK} — parcel boundary shown schematically. "
        "Verify against the effective FIRM at FEMA Map Service Center.",
    )
    base_map_img = ""
    if base_map_available and base_map_png:
        import base64

        b64 = base64.b64encode(base_map_png).decode("ascii")
        base_map_img = (
            f'<img src="data:image/png;base64,{b64}" alt="FEMA FIRM panel base map" '
            'style="max-width:100%; border:1px solid #333;"/>'
        )

    def row(label: str, value: str) -> str:
        return f"<tr><th>{label}</th><td>{value}</td></tr>"

    annotation_html = annotation.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    owner_html = (owner_label or "—").replace("&", "&amp;").replace("<", "&lt;")
    address_html = address.replace("&", "&amp;").replace("<", "&lt;")
    parcel_html = parcel_id.replace("&", "&amp;").replace("<", "&lt;")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>FIRMette-style evidence package — {parcel_html}</title>
<style>
  body {{ font-family: Helvetica, Arial, sans-serif; margin: 2em; color: #111; }}
  h1 {{ font-size: 1.4em; }}
  .banner {{ background: #fff3cd; border: 2px solid #b58900; padding: 0.8em; margin: 1em 0; font-weight: bold; }}
  table {{ border-collapse: collapse; margin: 1em 0; }}
  th, td {{ border: 1px solid #999; padding: 0.4em 0.8em; text-align: left; vertical-align: top; }}
  th {{ background: #eee; }}
  .panel {{ margin: 1em 0; max-width: 820px; }}
  .disclaimer {{ font-size: 0.9em; color: #444; }}
</style>
</head>
<body>
<h1>TSM FIRMette-style annotated evidence package</h1>
<div class="banner">DRAFT — ANNOTATED ILLUSTRATION. HUMAN REVIEW REQUIRED.<br/>
{base_map_note if isinstance(base_map_note, str) else base_map_note[0]}</div>
<table>
{row("Owner", owner_html)}
{row("Address", address_html)}
{row("Parcel ID", parcel_html)}
{row("BFE", f"{bfe_ft:g} ft NAVD88")}
{row("Generated (UTC)", generated_utc)}
{row("Provenance", "inputs: operator_supplied; base_map: "
  + ("fema_nfhl_rest_export" if base_map_available else "placeholder_offline") + "; renderer: html_fallback")}
</table>
<h2>Annotation</h2>
<p>{annotation_html if annotation_html else "—"}</p>
<h2>Map panel</h2>
<div class="panel">
{base_map_img}
{panel_svg}
</div>
<p class="disclaimer">This package is an annotated illustration assembled from operator-supplied
inputs. It is not a FEMA determination, LOMA/LOMC decision, FARA result, survey certification,
engineering certification, or submission approval. Parcel boundary and BFE callout are shown
schematically; verify against the effective FIRM/FIS and applicable LOMC record in the FEMA
Map Service Center before any use.</p>
</body>
</html>
"""


def build_pdf_reportlab(
    output: Path,
    *,
    parcel_id: str,
    address: str,
    owner_label: str,
    bfe_ft: float,
    annotation: str,
    base_map_available: bool,
    generated_utc: str,
    manifest: dict,
) -> None:
    """Minimal reportlab rendering. Only called when reportlab is importable."""
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(
        str(output),
        pagesize=LETTER,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.55 * inch,
    )
    base_map_line = (
        "Base map: retrieved from FEMA National Flood Hazard Layer (public REST export)."
        if base_map_available
        else f"Base map: {BASE_MAP_UNAVAILABLE_MARK} — parcel boundary shown schematically."
    )
    story = [
        Paragraph("TSM FIRMette-style annotated evidence package", styles["Title"]),
        Paragraph(
            f"Parcel: {parcel_id} · Address: {address} · Status: {PACKAGE_STATUS}",
            styles["Normal"],
        ),
        Spacer(1, 12),
        Paragraph(
            "This PDF is an annotated illustration assembled from operator-supplied "
            "inputs. It is not a FEMA determination, LOMA/LOMC decision, FARA result, "
            "survey certification, engineering certification, or submission approval.",
            styles["BodyText"],
        ),
        Spacer(1, 12),
        Paragraph(f"Owner: {owner_label or '—'}", styles["Normal"]),
        Paragraph(f"BFE: {bfe_ft:g} ft NAVD88", styles["Normal"]),
        Paragraph(f"Generated (UTC): {generated_utc}", styles["Normal"]),
        Paragraph(base_map_line, styles["Normal"]),
        Spacer(1, 8),
        Paragraph(f"Annotation: {annotation or '—'}", styles["BodyText"]),
        Spacer(1, 12),
        Paragraph(
            "Schematic rendering — not to scale. Parcel boundary and BFE callout are "
            "shown schematically; verify against the effective FIRM/FIS and applicable "
            "LOMC record in the FEMA Map Service Center before any use.",
            styles["BodyText"],
        ),
        Spacer(1, 12),
    ]
    rows = [
        [
            Paragraph("<b>Artifact</b>", styles["BodyText"]),
            Paragraph("<b>Bytes</b>", styles["BodyText"]),
            Paragraph("<b>SHA-256</b>", styles["BodyText"]),
        ]
    ]
    for item in manifest["artifacts"]:
        rows.append(
            [
                Paragraph(str(item["path"]), styles["BodyText"]),
                str(item["bytes"]),
                Paragraph(str(item["sha256"]), styles["BodyText"]),
            ]
        )
    table = Table(rows, repeatRows=1, colWidths=[2.6 * inch, 0.9 * inch, 3.5 * inch])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.35, None),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(table)
    doc.build(story)


def _slug(text: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in text.strip())


def generate_firmette(
    polygon: Sequence[Sequence[float]],
    parcel_id: str,
    address: str,
    bfe_ft: float,
    *,
    owner_label: str = "",
    annotation: str = "",
    output_dir: Path | str,
    base_map_mode: str = "auto",
    renderer: str = "auto",
    generated_utc: str | None = None,
) -> dict:
    """Generate the package. Returns a summary dict with paths and the manifest.

    base_map_mode: "auto" (attempt retrieval, fail closed to placeholder),
        "offline" (always use the watermarked placeholder, no network),
        "require" (raise if retrieval fails).
    renderer: "auto" (reportlab PDF when importable, else HTML), "pdf", "html".
    """
    points, parcel_id, address, bfe_ft = validate_inputs(polygon, parcel_id, address, bfe_ft)
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    if base_map_mode not in ("auto", "offline", "require"):
        raise ValueError(f"base_map_mode must be auto/offline/require, got {base_map_mode!r}")
    if os.environ.get("TSM_FIRMETTE_OFFLINE") == "1":
        base_map_mode = "offline"

    bbox = padded_bbox(points)
    base_map_png: bytes | None = None
    base_map_available = False
    if base_map_mode != "offline":
        try:
            base_map_png = fetch_firm_panel_image(bbox)
            base_map_available = True
        except Exception as exc:  # fail closed
            if base_map_mode == "require":
                raise ValueError(f"FIRM panel retrieval failed and base_map_mode='require': {exc}") from exc
            base_map_available = False
            base_map_png = None

    if renderer == "auto":
        renderer = "pdf" if _reportlab_available() else "html"
    if renderer not in ("pdf", "html"):
        raise ValueError(f"renderer must be auto/pdf/html, got {renderer!r}")
    if renderer == "pdf" and not _reportlab_available():
        raise ValueError("renderer='pdf' requested but reportlab is not importable")

    generated_utc = generated_utc or datetime.now(timezone.utc).isoformat()
    parcel_slug = _slug(parcel_id)

    artifacts: dict[str, Path] = {}
    if base_map_available and base_map_png:
        png_path = out / f"FIRMETTE-{parcel_slug}-basemap.png"
        png_path.write_bytes(base_map_png)
        artifacts["base_map"] = png_path

    provenance = {
        "inputs": "operator_supplied",
        "base_map": "fema_nfhl_rest_export" if base_map_available else "placeholder_offline",
        "renderer": "reportlab_pdf" if renderer == "pdf" else "html_fallback",
        "generated_utc": generated_utc,
        "generator": "tools/loma/firmette.py",
    }
    manifest: dict = {
        "schema_version": SCHEMA_VERSION,
        "package_status": PACKAGE_STATUS,
        "authority": "FEMA Flood Map Service Center (reference only)",
        "submission_authority": "human_operator",
        "regulatory_determination": False,
        "inputs": {
            "parcel_id": parcel_id,
            "address": address,
            "owner_label": owner_label,
            "bfe_ft_navd88": bfe_ft,
            "annotation": annotation,
            "polygon_lonlat": points,
        },
        "provenance": provenance,
        "artifacts": [],
    }

    if renderer == "pdf":
        doc_path = out / f"FIRMETTE-{parcel_slug}.pdf"
        # The PDF embeds the input-artifact table, so it is built before its own
        # bytes/hash are recorded: a file cannot hash itself. The PDF's own entry
        # is added to the manifest by the shared block below, after it is written.
        manifest["artifacts"] = [
            {"path": p.relative_to(out).as_posix(), "bytes": p.stat().st_size, "sha256": sha256_file(p)}
            for p in sorted(artifacts.values())
        ]
        build_pdf_reportlab(
            doc_path,
            parcel_id=parcel_id,
            address=address,
            owner_label=owner_label,
            bfe_ft=bfe_ft,
            annotation=annotation,
            base_map_available=base_map_available,
            generated_utc=generated_utc,
            manifest=manifest,
        )
        artifacts["document"] = doc_path
    else:
        html = build_html(
            parcel_id=parcel_id,
            address=address,
            owner_label=owner_label,
            bfe_ft=bfe_ft,
            annotation=annotation,
            points=points,
            bbox=bbox,
            base_map_available=base_map_available,
            generated_utc=generated_utc,
            base_map_png=base_map_png,
        )
        doc_path = out / f"FIRMETTE-{parcel_slug}.html"
        doc_path.write_text(html, encoding="utf-8")
        artifacts["document"] = doc_path

    manifest["artifacts"] = [
        {
            "path": p.relative_to(out).as_posix(),
            "bytes": p.stat().st_size,
            "sha256": sha256_file(p),
        }
        for p in sorted(artifacts.values())
    ]
    manifest_path = out / f"FIRMETTE-{parcel_slug}-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    return {
        "parcel_id": parcel_id,
        "output_dir": str(out),
        "renderer": renderer,
        "base_map_available": base_map_available,
        "document": str(doc_path),
        "manifest_path": str(manifest_path),
        "manifest": manifest,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate an annotated FIRMette-style evidence package.")
    parser.add_argument("--polygon-json", required=True, help="JSON list of [lon, lat] points")
    parser.add_argument("--parcel-id", required=True)
    parser.add_argument("--address", required=True)
    parser.add_argument("--bfe", required=True, type=float, help="BFE in feet NAVD88")
    parser.add_argument("--owner", default="")
    parser.add_argument("--annotation", default="")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--base-map-mode", default="auto", choices=["auto", "offline", "require"])
    parser.add_argument("--renderer", default="auto", choices=["auto", "pdf", "html"])
    args = parser.parse_args()

    polygon = json.loads(args.polygon_json)
    result = generate_firmette(
        polygon,
        args.parcel_id,
        args.address,
        args.bfe,
        owner_label=args.owner,
        annotation=args.annotation,
        output_dir=args.output_dir,
        base_map_mode=args.base_map_mode,
        renderer=args.renderer,
    )
    print(json.dumps(
        {
            "parcel_id": result["parcel_id"],
            "renderer": result["manifest"]["provenance"]["renderer"],
            "base_map_available": result["base_map_available"],
            "document": result["document"],
            "manifest": result["manifest_path"],
            "status": result["manifest"]["package_status"],
        },
        indent=2,
    ))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
