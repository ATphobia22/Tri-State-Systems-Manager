"""Read-only Leica GSI reader — hand-written, standard library only.

GSI (Geo Serial Interface) is Leica's ASCII total-station format. A
file is a sequence of datablocks (one per line); each block is a run
of fixed-width data words. A word starts with a two-digit Word Index
(WI) naming the data type, followed by information characters, then a
signed integer value.

This reader is deliberately low-level, in the same spirit as
pySurveying's ``read_gsi`` (MIT): it returns word records and block
groupings and converts values only where the conversion is documented
below and the caller supplies the instrument's unit/decimal settings.
It does not pretend to support every Leica generation or project
template, and it is not an instrument driver — it only reads files.

Word Index table (public Leica TPS/DNA documentation; see
``docs/survey/SURVEY-COMPUTATION-NOTES.md`` for sources)
-----------------------------------------------------------------
=======  =======================================================
WI       Meaning
=======  =======================================================
11       Point number (starts a datablock)
12       Serial number
21       Horizontal angle (Hz)
22       Vertical angle (V)
31       Slope distance
32       Horizontal distance
33       Height difference
41       Point code (first)
42       Point code (second) / attribute
51       ppm / atmospheric correction
71–79    Remarks / attributes 1–9
81       Target easting (E)
82       Target northing (N)
83       Target elevation (H)
84       Station easting (E0)
85       Station northing (N0)
86       Station height (H0)
87       Reflector height
88       Instrument height
=======  =======================================================

Value scaling (caller-supplied, never guessed)
----------------------------------------------
GSI stores values as signed integers with implied decimals. The
number of implied decimals depends on the instrument configuration
(the info characters in the word) and the unit system. Examples from
Leica documentation: a GSI-8 coordinate word ``81..00+01999507``
is 1999.507 m (3 implied decimals); an angle word
``21.102+17920860`` is 179.20860 gon. This module therefore converts
only when the caller passes ``decimals`` (and, for angles, ``unit``),
and records the assumption in the result. The raw integer is always
kept alongside any converted value.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

# A GSI word token: exactly two-digit word index, information
# characters that contain no sign, then a signed integer. Leica word
# indexes are two digits (11, 21, 31, 81 …); taking three digits
# would misread real tokens such as "110001+00001001" (WI 11, block
# 0001, point 1001) as word 110. This deliberately differs from
# pySurveying's low-level reader, whose ``\d{2,3}`` pattern has that
# flaw on real GSI-8 files — the deviation is recorded here and
# covered by backend/tests/test_survey_gsi.py.
_WORD_RE = re.compile(r"^(?P<word>\d{2})(?P<info>[^+\-]*)(?P<value>[+\-]\d+)")

WORD_INDEX_MEANING: dict[int, str] = {
    11: "point number",
    12: "serial number",
    21: "horizontal angle (Hz)",
    22: "vertical angle (V)",
    31: "slope distance",
    32: "horizontal distance",
    33: "height difference",
    41: "point code",
    42: "point code / attribute",
    51: "ppm / atmospheric correction",
    71: "remark / attribute 1",
    72: "remark / attribute 2",
    73: "remark / attribute 3",
    74: "remark / attribute 4",
    75: "remark / attribute 5",
    76: "remark / attribute 6",
    77: "remark / attribute 7",
    78: "remark / attribute 8",
    79: "remark / attribute 9",
    81: "target easting (E)",
    82: "target northing (N)",
    83: "target elevation (H)",
    84: "station easting (E0)",
    85: "station northing (N0)",
    86: "station height (H0)",
    87: "reflector height",
    88: "instrument height",
}


def parse_gsi_text(text: str) -> list[dict[str, Any]]:
    """Parse GSI text into low-level word records.

    Each record: ``line``, ``word`` (WI int), ``meaning``, ``info``
    (the characters between the WI and the sign), ``value`` (raw signed
    int), ``raw`` (the original token). Tokens that do not match the
    GSI word shape are skipped; :func:`read_gsi` counts them.
    """
    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        for token in line.strip().split():
            match = _WORD_RE.match(token)
            if match is None:
                continue
            word = int(match.group("word"))
            info = match.group("info")
            records.append(
                {
                    "line": line_number,
                    "word": word,
                    "meaning": WORD_INDEX_MEANING.get(word, "unknown word index"),
                    "info": info,
                    "value": int(match.group("value")),
                    "raw": token,
                }
            )
    return records


def read_gsi(path: str | Path) -> dict[str, Any]:
    """Read a ``.gsi``/``.gsi8``/``.gsi16`` file into word records + blocks.

    Returns ``{"records": [...], "blocks": [...], "skipped_tokens": n}``.
    Blocks are split on WI 11 (point number), which starts a datablock
    in Leica's format. ``skipped_tokens`` counts whitespace-separated
    tokens that did not match the GSI word shape.
    """
    path = Path(path)
    text = path.read_text(encoding="latin-1")
    records = parse_gsi_text(text)
    total_tokens = sum(len(line.split()) for line in text.splitlines())
    blocks: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] | None = None
    for record in records:
        if record["word"] == 11:
            current = []
            blocks.append(current)
        if current is None:
            current = []
            blocks.append(current)
        current.append(record)
    return {
        "source": str(path),
        "records": records,
        "blocks": blocks,
        "block_count": len(blocks),
        "skipped_tokens": total_tokens - len(records),
        "provisional": True,
    }


def gsi_block_points(
    blocks: list[list[dict[str, Any]]],
    *,
    coordinate_decimals: int = 3,
) -> list[dict[str, Any]]:
    """Extract target points (WI 81/82/83) from GSI blocks.

    ``coordinate_decimals`` is the number of implied decimals in the
    coordinate words — 3 for the usual GSI-8 metre output (Leica
    example: ``81..00+01999507`` = 1999.507 m). Pass the value your
    instrument/file actually uses; the assumption is recorded on every
    point. Blocks without a complete 81/82 triple are reported with
    ``complete: False`` and no coordinates, never silently dropped.
    """
    if coordinate_decimals < 0:
        raise ValueError("coordinate_decimals must be non-negative")
    scale = 10.0**coordinate_decimals
    points: list[dict[str, Any]] = []
    for block in blocks:
        by_word: dict[int, dict[str, Any]] = {}
        point_number: int | None = None
        for record in block:
            if record["word"] == 11 and point_number is None:
                point_number = record["value"]
            by_word.setdefault(record["word"], record)
        easting = by_word.get(81)
        northing = by_word.get(82)
        elevation = by_word.get(83)
        point: dict[str, Any] = {
            "point_number": point_number,
            "complete": easting is not None and northing is not None,
            "coordinate_decimals_assumed": coordinate_decimals,
            "provisional": True,
        }
        if easting is not None:
            point["x"] = easting["value"] / scale
        if northing is not None:
            point["y"] = northing["value"] / scale
        if elevation is not None:
            point["z"] = elevation["value"] / scale
        points.append(point)
    return points


def gsi_angle_degrees(
    raw_value: int, *, decimals: int = 5, unit: str = "gon"
) -> float:
    """Convert a raw GSI angle word to decimal degrees.

    Leica GSI angles are usually recorded in gon (400 gon = 360°);
    ``unit`` may be ``"gon"`` (default) or ``"deg"``. ``decimals`` is
    the implied-decimal count for the word (5 in Leica's example
    ``21.102+17920860`` = 179.20860 gon). Both settings are explicit
    parameters because they depend on instrument configuration.
    """
    if unit not in {"gon", "deg"}:
        raise ValueError('unit must be "gon" or "deg"')
    value = raw_value / (10.0**decimals)
    if unit == "gon":
        return value * 360.0 / 400.0
    return value


def gsi_angle_gon_to_deg(gon: float) -> float:
    """Convert gon to decimal degrees (400 gon = 360 degrees)."""
    return float(gon) * 360.0 / 400.0
