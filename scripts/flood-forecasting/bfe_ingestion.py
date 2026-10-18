#!/usr/bin/env python3
"""
TSM Flood Forecasting — BFE (Base Flood Elevation) Ingestion, Phase 2.

Fills the gap left by HEC-RAS model 4449, whose domain ends at Ohio River
Mile 844.75 while the TSM anchor site sits near RM ~846.

Two ingestion paths:

  1. USGS InFRM Estimated BFE (estBFE) Viewer
     (https://webapps.usgs.gov/infrm/estbfe/)
     -- point query for estimated 1%-annual-chance flood elevation.

  2. FIS (Flood Insurance Study) PDF parsing
     -- Floodway Data Table (FDT) and stream profile panels, extracted
     with pdfplumber from a user-supplied FIS PDF.

A synthesis step combines whatever is actually retrieved and labels the
result honestly (ESTIMATED / DERIVED -- never REGULATORY).

HONESTY CONTRACT (read before using):
  * The working BFE target of 375.0 ft NAVD88 is a WORKING TARGET from
    Bonebank_LOMA_Checklist.pdf. It is NOT confirmed by any of these tools
    unless the tool output actually contains it.
  * The InFRM estBFE viewer covers FEMA Region 6 ONLY (TX, OK, NM, LA, AR).
    The tri-state site (Posey County, IN -- FEMA Region 5) is OUTSIDE its
    coverage. query_infrm_bfe() reports this instead of inventing data.
  * FIS parsing requires a user-supplied PDF (FEMA MSC, CID 180209 for
    Posey County). No PDF is bundled in the repo.
  * Every function returns a dict with a "status" field:
      "ok"          -- data actually retrieved
      "unavailable" -- source checked, nothing usable (reason given)
      "error"       -- the attempt itself failed (reason given)

Usage:
  python bfe_ingestion.py --lat 37.845887 --lon -88.005075
  python bfe_ingestion.py --lat 37.845887 --lon -88.005075 --fis-pdf /path/to/fis.pdf
  python bfe_ingestion.py --check-coverage --lat 37.845887 --lon -88.005075
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# USGS InFRM Estimated BFE Viewer (FEMA Region 6 BLE program)
INFRM_ESTBFE_VIEWER = "https://webapps.usgs.gov/infrm/estbfe/"
INFRM_DOCS = "https://webapps.usgs.gov/infrm/home/estbfe-region6.html"

# Approximate bounding box of FEMA Region 6 states (TX, OK, NM, LA, AR).
# Used ONLY as a coarse coverage gate: points outside are reported as
# out-of-coverage rather than queried pointlessly.
# (min_lon, min_lat, max_lon, max_lat), WGS84.
REGION6_BBOX = (-106.6, 25.8, -88.7, 37.1)

# Anchor site (public per owner 2026-09-27 decision)
ANCHOR_LAT = 37.845887
ANCHOR_LON = -88.005075

REQUEST_TIMEOUT = 30

# ---------------------------------------------------------------------------
# Result containers
# ---------------------------------------------------------------------------


@dataclass
class InfrmResult:
    status: str                       # ok | unavailable | error
    bfe_ft: float | None = None
    flood_depth_ft: float | None = None
    risk_class: str | None = None     # High | Moderate | Low
    watershed: str | None = None
    vintage: str | None = None
    datum: str | None = None
    reason: str = ""
    endpoints_tried: list = field(default_factory=list)


@dataclass
class FisRow:
    cross_section: str
    river_mile: float | None
    floodway_width_ft: float | None
    base_flood_elevation_ft: float | None
    datum: str | None = None


@dataclass
class FisParseResult:
    status: str                       # ok | unavailable | error
    rows: list = field(default_factory=list)
    source_pdf: str = ""
    reason: str = ""


@dataclass
class BfeSynthesis:
    status: str                       # ok | unavailable
    bfe_ft: float | None = None
    label: str = ""                   # ESTIMATED | DERIVED | WORKING TARGET | UNAVAILABLE
    sources: list = field(default_factory=list)
    caveats: list = field(default_factory=list)
    reason: str = ""


# ---------------------------------------------------------------------------
# 1. USGS InFRM Estimated BFE Viewer
# ---------------------------------------------------------------------------

# Candidate REST endpoints backing the estBFE viewer, in probe order.
# Discovered 2026-10-18: the viewer app itself is a JS SPA at
# webapps.usgs.gov (HTTP 403 to unauthenticated curl from this
# environment); its data services are not published in the ArcGIS Online
# public search index. These candidates are the documented/adjacent
# public services to probe before concluding unavailability.
INFRM_ENDPOINT_CANDIDATES = [
    # InFRM program home (documents coverage = Region 6)
    "https://webapps.usgs.gov/infrm/home/estbfe-region6.html",
    # Viewer application
    "https://webapps.usgs.gov/infrm/estbfe/",
]


def in_region6(lat: float, lon: float) -> bool:
    """Coarse FEMA Region 6 coverage gate (WGS84 bbox)."""
    min_lon, min_lat, max_lon, max_lat = REGION6_BBOX
    return (min_lon <= lon <= max_lon) and (min_lat <= lat <= max_lat)


def query_infrm_bfe(lat: float, lon: float) -> InfrmResult:
    """Query the USGS InFRM Estimated BFE Viewer for a point.

    Honest behavior:
      * If the point is outside FEMA Region 6 -> "unavailable" with the
        coverage reason. The tri-state AOI (IN/IL/KY, Regions 4/5) is
        outside coverage as of 2026-10-18.
      * Otherwise, probe the documented endpoints. If the service cannot
        be reached or returns nothing usable -> "unavailable"/"error"
        with the reason. Never fabricates a BFE.
    """
    tried: list[str] = []

    if not in_region6(lat, lon):
        return InfrmResult(
            status="unavailable",
            reason=(
                "Point (%.6f, %.6f) is outside FEMA Region 6. The USGS "
                "InFRM Estimated BFE Viewer publishes Base Level "
                "Engineering results for Region 6 states only "
                "(TX, OK, NM, LA, AR); the tri-state site is in FEMA "
                "Region 5 (Indiana/Illinois) / Region 4 (Kentucky). "
                "Per USGS (2024), expansion to Region 9 was 'coming "
                "soon'; Regions 4/5 were not announced."
                % (lat, lon)
            ),
            endpoints_tried=[INFRM_ESTBFE_VIEWER],
        )

    # Inside Region 6: attempt to reach the viewer services.
    for url in INFRM_ENDPOINT_CANDIDATES:
        tried.append(url)
        try:
            r = requests.get(url, timeout=REQUEST_TIMEOUT,
                             headers={"User-Agent": "TSM-BFE-Ingestion/1.0"})
            # A 200 on the HTML shell does not itself yield data; the
            # viewer is a JS SPA whose data services require browser
            # execution. Record reachability honestly.
            if r.status_code == 200 and len(r.content) > 1000:
                return InfrmResult(
                    status="unavailable",
                    reason=(
                        "InFRM estBFE viewer shell is reachable, but its "
                        "data services are a JavaScript SPA with no "
                        "published point-query REST endpoint found "
                        "(2026-10-18). Use the interactive viewer at %s "
                        "to read the estimated BFE manually."
                        % INFRM_ESTBFE_VIEWER
                    ),
                    endpoints_tried=tried,
                )
        except requests.RequestException as e:
            # Keep probing remaining candidates.
            tried.append(f"{url} -> {type(e).__name__}: {e}")
            continue

    return InfrmResult(
        status="error",
        reason="Could not reach any InFRM estBFE endpoint.",
        endpoints_tried=tried,
    )


# ---------------------------------------------------------------------------
# 2. FIS PDF parsing (Floodway Data Table + profile panels)
# ---------------------------------------------------------------------------

# Header variants seen in FEMA Floodway Data Tables.
_FDT_HEADERS = [
    "cross section", "river mile", "floodway", "base flood",
    "water surface elevation", "width", "section area",
    "mean velocity", "regulatory",
]


def _looks_like_fdt_header(cells: list[str]) -> bool:
    joined = " ".join(cells).lower()
    hits = sum(1 for h in _FDT_HEADERS if h in joined)
    return hits >= 3


def _num(text: str) -> float | None:
    """Parse a number from messy PDF cell text."""
    if not text:
        return None
    m = re.search(r"-?\d[\d,]*\.?\d*", text.replace(",", ""))
    if not m:
        return None
    try:
        return float(m.group(0))
    except ValueError:
        return None


def parse_fis_floodway_table(pdf_path: str | Path) -> FisParseResult:
    """Extract the Floodway Data Table from an FIS PDF via pdfplumber.

    Returns structured rows; empty rows list with status "unavailable"
    if no FDT-like table is found. Requires the user-supplied FIS PDF
    (FEMA MSC, e.g. CID 180209 for Posey County, IN).
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        return FisParseResult(status="error", source_pdf=str(pdf_path),
                              reason=f"PDF not found: {pdf_path}")

    try:
        import pdfplumber
    except ImportError:
        return FisParseResult(status="error", source_pdf=str(pdf_path),
                              reason="pdfplumber is not installed "
                                     "(pip install pdfplumber)")

    rows: list[FisRow] = []
    pages_scanned = 0
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            for page in pdf.pages:
                pages_scanned += 1
                tables = page.extract_tables() or []
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    header = [str(c or "").strip() for c in table[0]]
                    if not _looks_like_fdt_header(header):
                        continue
                    # Map columns by header keywords.
                    hlow = [h.lower() for h in header]

                    def col(*keys):
                        for i, h in enumerate(hlow):
                            if all(k in h for k in keys):
                                return i
                        return None

                    c_xs = col("cross", "section")
                    c_rm = col("river", "mile")
                    c_fw = col("floodway")
                    c_bfe = col("base", "flood")
                    if c_bfe is None:
                        c_bfe = col("water", "surface")

                    for line in table[1:]:
                        cells = [str(c or "").strip() for c in line]
                        if not any(cells):
                            continue
                        xs = cells[c_xs] if c_xs is not None else ""
                        if not xs or "total" in xs.lower():
                            continue
                        rows.append(FisRow(
                            cross_section=xs,
                            river_mile=_num(cells[c_rm]) if c_rm is not None else None,
                            floodway_width_ft=_num(cells[c_fw]) if c_fw is not None else None,
                            base_flood_elevation_ft=_num(cells[c_bfe]) if c_bfe is not None else None,
                        ))
    except Exception as e:  # noqa: BLE001 -- report, don't crash
        return FisParseResult(status="error", source_pdf=str(pdf_path),
                              reason=f"PDF parse failed: {type(e).__name__}: {e}")

    if not rows:
        return FisParseResult(
            status="unavailable", source_pdf=str(pdf_path),
            reason=(f"Scanned {pages_scanned} pages; no Floodway Data "
                    "Table detected. The PDF may be a different FIS "
                    "volume or a scanned image PDF without text tables."),
        )
    return FisParseResult(status="ok", rows=[asdict(r) for r in rows],
                          source_pdf=str(pdf_path),
                          reason=f"Extracted {len(rows)} FDT rows.")


def parse_fis_profiles(pdf_path: str | Path,
                       stream_name: str = "Ohio River") -> FisParseResult:
    """Extract water-surface elevations from FIS profile panel pages.

    Heuristic text scan: finds lines mentioning the stream name near
    elevation-like numbers and river-mile markers. Best-effort; profile
    panels are often vector graphics with sparse text, so "unavailable"
    is a normal honest outcome.
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        return FisParseResult(status="error", source_pdf=str(pdf_path),
                              reason=f"PDF not found: {pdf_path}")
    try:
        import pdfplumber
    except ImportError:
        return FisParseResult(status="error", source_pdf=str(pdf_path),
                              reason="pdfplumber is not installed")

    rows: list[FisRow] = []
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                if "profile" not in text.lower():
                    continue
                if stream_name.lower() not in text.lower():
                    continue
                # Capture "RIVER MILE xxx" ... elevation patterns.
                for m in re.finditer(
                        r"[Rr][Ii][Vv][Ee][Rr]\s*[Mm][Ii][Ll][Ee]\s*"
                        r"(\d+(?:\.\d+)?)[^\n]{0,120}?"
                        r"(\d{3,4}\.\d)\s*(?:ft|feet|NGVD|NAVD)?",
                        text):
                    rows.append(FisRow(
                        cross_section=f"profile-RM-{m.group(1)}",
                        river_mile=float(m.group(1)),
                        floodway_width_ft=None,
                        base_flood_elevation_ft=float(m.group(2)),
                    ))
    except Exception as e:  # noqa: BLE001
        return FisParseResult(status="error", source_pdf=str(pdf_path),
                              reason=f"PDF parse failed: {type(e).__name__}: {e}")

    if not rows:
        return FisParseResult(
            status="unavailable", source_pdf=str(pdf_path),
            reason="No profile-panel elevations recovered (panels are "
                   "often vector graphics without extractable text).")
    # Deduplicate on river mile.
    seen, uniq = set(), []
    for r in rows:
        key = r.river_mile
        if key not in seen:
            seen.add(key)
            uniq.append(asdict(r))
    return FisParseResult(status="ok", rows=uniq, source_pdf=str(pdf_path),
                          reason=f"Recovered {len(uniq)} profile points.")


# ---------------------------------------------------------------------------
# 3. BFE boundary synthesis
# ---------------------------------------------------------------------------

# Working target from Bonebank_LOMA_Checklist.pdf (2026-08-22), explicitly
# labeled there as a working value, NOT a confirmed regulatory BFE.
WORKING_BFE_FT_NAVD88 = 375.0
WORKING_BFE_NOTE = (
    "Working target from Bonebank_LOMA_Checklist.pdf; DFIRM 18129C "
    "STATIC_BFE is NULL at the anchor parcel (sentinel -9999 is genuine). "
    "Requires INFIP FARA report or FIS PDF (MSC, CID 180209) to confirm."
)


def synthesize_bfe_boundary(lat: float, lon: float,
                            fis_pdf: str | Path | None = None) -> BfeSynthesis:
    """Combine retrieved sources into a site BFE estimate.

    Precedence: InFRM retrieved value > FIS FDT nearest cross-section >
    working target (labeled as such) > unavailable.

    The result is ALWAYS labeled ESTIMATED or WORKING TARGET -- never
    REGULATORY. A regulatory BFE comes only from an effective FIRM/FIS
    or a FEMA determination.
    """
    caveats = [
        "Result is ESTIMATED/DERIVED, not a regulatory BFE.",
        "HEC-RAS 4449 domain ends at RM 844.75; site is near RM ~846.",
    ]
    sources: list[str] = []

    # Path 1: InFRM estBFE.
    infrm = query_infrm_bfe(lat, lon)
    if infrm.status == "ok" and infrm.bfe_ft is not None:
        sources.append("USGS InFRM estBFE")
        return BfeSynthesis(
            status="ok", bfe_ft=infrm.bfe_ft, label="ESTIMATED",
            sources=sources,
            caveats=caveats + [
                f"Datum reported by source: {infrm.datum or 'unknown'}; "
                "verify before comparing to NAVD88 values.",
                f"Source vintage: {infrm.vintage or 'unknown'}.",
            ],
        )
    caveats.append(f"InFRM: {infrm.reason}")

    # Path 2: FIS Floodway Data Table.
    if fis_pdf:
        fdt = parse_fis_floodway_table(fis_pdf)
        if fdt.status == "ok" and fdt.rows:
            sources.append(f"FIS Floodway Data Table ({Path(fis_pdf).name})")
            # Nearest cross-section by river mile to the site (~RM 846).
            best = None
            for r in fdt.rows:
                rm = r.get("river_mile")
                bfe = r.get("base_flood_elevation_ft")
                if rm is None or bfe is None:
                    continue
                if best is None or abs(rm - 846.0) < abs(best[0] - 846.0):
                    best = (rm, bfe, r.get("cross_section"))
            if best:
                caveats.append(
                    f"Nearest FDT cross-section {best[2]} at RM {best[0]}; "
                    "site RM ~846 is approximate.")
                return BfeSynthesis(
                    status="ok", bfe_ft=best[1], label="ESTIMATED",
                    sources=sources, caveats=caveats)
        caveats.append(f"FIS FDT: {fdt.reason if 'fdt' in locals() else 'no PDF'}")
    else:
        caveats.append("FIS: no PDF supplied (--fis-pdf).")

    # Path 3: working target (explicitly labeled).
    sources.append("Bonebank_LOMA_Checklist.pdf working value")
    caveats.append(WORKING_BFE_NOTE)
    return BfeSynthesis(
        status="ok", bfe_ft=WORKING_BFE_FT_NAVD88,
        label="WORKING TARGET -- UNCONFIRMED",
        sources=sources, caveats=caveats,
        reason="No retrieved BFE; falling back to labeled working target.",
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="TSM BFE ingestion Phase 2: InFRM estBFE + FIS PDF parsing.")
    ap.add_argument("--lat", type=float, default=ANCHOR_LAT)
    ap.add_argument("--lon", type=float, default=ANCHOR_LON)
    ap.add_argument("--fis-pdf", default=None,
                    help="Path to FIS PDF (FEMA MSC, e.g. CID 180209)")
    ap.add_argument("--check-coverage", action="store_true",
                    help="Only report InFRM coverage for the point")
    ap.add_argument("--parse-fdt", action="store_true",
                    help="Only parse the Floodway Data Table from --fis-pdf")
    ap.add_argument("--parse-profiles", action="store_true",
                    help="Only parse profile panels from --fis-pdf")
    ap.add_argument("--json", action="store_true",
                    help="Emit machine-readable JSON")
    args = ap.parse_args(argv)

    if args.check_coverage:
        res = query_infrm_bfe(args.lat, args.lon)
        out = asdict(res)
        print(json.dumps(out, indent=2) if args.json else
              f"status={res.status}\nreason={res.reason}")
        return 0

    if args.parse_fdt:
        if not args.fis_pdf:
            print("--fis-pdf is required", file=sys.stderr)
            return 2
        res = parse_fis_floodway_table(args.fis_pdf)
        print(json.dumps(asdict(res), indent=2))
        return 0

    if args.parse_profiles:
        if not args.fis_pdf:
            print("--fis-pdf is required", file=sys.stderr)
            return 2
        res = parse_fis_profiles(args.fis_pdf)
        print(json.dumps(asdict(res), indent=2))
        return 0

    syn = synthesize_bfe_boundary(args.lat, args.lon, args.fis_pdf)
    if args.json:
        print(json.dumps(asdict(syn), indent=2))
    else:
        print(f"BFE: {syn.bfe_ft} ft  [{syn.label}]")
        print(f"status: {syn.status}")
        for s in syn.sources:
            print(f"  source: {s}")
        for c in syn.caveats:
            print(f"  caveat: {c}")
        if syn.reason:
            print(f"  note: {syn.reason}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
