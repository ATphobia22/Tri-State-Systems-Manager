#!/usr/bin/env python3
"""Offline, headless PDF evidence cover sheet. Does not certify engineering findings."""
import argparse
import hashlib
import json
import re
from pathlib import Path

ALLOWED = {"VERIFIED", "PENDING", "BLOCKED", "NOT_EVIDENCED"}
SHA256 = re.compile(r"^[a-fA-F0-9]{64}$")
CATEGORIES = {"terrain", "buildings", "roads", "parcels", "floodplain", "storm_sewer",
              "sanitary_sewer", "potable_water", "electric", "gas", "telecom", "drainage",
              "right_of_way", "proposed_construction", "other"}


def validate(data):
    if not isinstance(data, dict) or not isinstance(data.get("project"), str) or not data["project"].strip():
        raise ValueError("project must be a nonempty string")
    items = data.get("evidence")
    if not isinstance(items, list) or not 1 <= len(items) <= 200:
        raise ValueError("evidence must contain 1..200 entries")
    for index, item in enumerate(items):
        if not isinstance(item, dict) or item.get("status") not in ALLOWED:
            raise ValueError(f"evidence[{index}] has invalid status")
        if item.get("layer") not in CATEGORIES:
            raise ValueError(f"evidence[{index}] has unknown engineering layer")
        if not isinstance(item.get("description"), str) or not item["description"].strip():
            raise ValueError(f"evidence[{index}] requires description")
        if item["status"] == "VERIFIED":
            if not SHA256.fullmatch(str(item.get("sha256", ""))):
                raise ValueError(f"evidence[{index}] VERIFIED requires SHA-256")
            if not all(isinstance(item.get(k), str) and item[k].strip()
                       for k in ("source", "acquired_utc", "crs", "vertical_datum", "units", "verification_method")):
                raise ValueError(f"evidence[{index}] VERIFIED requires provenance, CRS, datum, units and verification method")
    return items


def create_pdf(data, output, input_sha):
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.enums import TA_LEFT
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
    from xml.sax.saxutils import escape
    items = validate(data)
    styles = getSampleStyleSheet()
    styles["Normal"].fontSize = 9
    styles["Normal"].leading = 13
    styles["Normal"].alignment = TA_LEFT
    doc = SimpleDocTemplate(str(output), pagesize=(612, 792), leftMargin=46,
                            rightMargin=46, topMargin=44, bottomMargin=44)
    story = [Paragraph("TRI-STATE SYSTEMS MANAGER", styles["Title"]),
             Paragraph("Engineering evidence register | Offline review copy", styles["Heading2"]),
             Paragraph("Project: " + escape(data["project"]), styles["Normal"]),
             Paragraph("Input JSON SHA-256: " + input_sha, styles["Normal"]),
             Spacer(1, 14)]
    notice = ("NOT A SURVEY, CONSTRUCTION PLAN, HYDRAULIC CERTIFICATION, "
              "UTILITY LOCATION, REGULATORY DETERMINATION OR GRANT AWARD. "
              "Source assertions require independent review; PDF creation does not verify them.")
    story.extend([Paragraph(notice, styles["Normal"]), Spacer(1, 14)])
    for n, item in enumerate(items, 1):
        rows = [("Layer", item["layer"]), ("Status", item["status"]),
                ("Description", item["description"]),
                ("Source", item.get("source", "NOT PROVIDED")),
                ("Source SHA-256", item.get("sha256", "NOT PROVIDED")),
                ("Acquisition UTC", item.get("acquired_utc", "NOT PROVIDED")),
                ("CRS / vertical datum / units", " / ".join(str(item.get(k, "NOT PROVIDED"))
                    for k in ("crs", "vertical_datum", "units"))),
                ("Verification method", item.get("verification_method", "NOT PROVIDED"))]
        table = Table([[Paragraph(escape(str(k)), styles["Normal"]),
                        Paragraph(escape(str(v)), styles["Normal"])] for k, v in rows],
                      colWidths=[145, 375], hAlign="LEFT")
        table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                                   ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e9edf2")),
                                   ("LINEBELOW", (0, -1), (-1, -1), 0.4, colors.grey),
                                   ("LEFTPADDING", (0, 0), (-1, -1), 7),
                                   ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                                   ("TOPPADDING", (0, 0), (-1, -1), 4),
                                   ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        story.append(KeepTogether([Paragraph(f"Evidence {n:03d}", styles["Heading3"]), table, Spacer(1, 12)]))
    doc.build(story)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Refusing to overwrite existing evidence PDF")
    raw = args.input.read_bytes()
    data = json.loads(raw)
    validate(data)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    create_pdf(data, args.output, hashlib.sha256(raw).hexdigest())
    print(f"PDF_CREATED_REVIEW_REQUIRED {args.output}")


if __name__ == "__main__":
    main()
