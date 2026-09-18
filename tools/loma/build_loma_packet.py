#!/usr/bin/env python3
"""Build an evidence-indexed FEMA Online LOMC/LOMA packet.

This tool assembles only supplied source files. It does not create survey data,
FIRM determinations, FARA results, FEMA decisions, or submission approvals.
Cryptographic signing is deliberately separate from packet assembly.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_manifest(case_id: str, source_dir: Path) -> dict[str, object]:
    files = []
    for path in sorted(p for p in source_dir.rglob("*") if p.is_file()):
        files.append(
            {
                "path": path.relative_to(source_dir).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
        )
    return {
        "schema_version": "tsm-lomc-packet-v1",
        "case_id": case_id,
        "packet_status": "DRAFT_ASSEMBLY_HUMAN_REVIEW_REQUIRED",
        "authority": "FEMA Online LOMC",
        "submission_authority": "human_operator",
        "regulatory_determination": False,
        "source_files": files,
    }


def build_pdf(manifest: dict[str, object], output: Path) -> None:
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(
        str(output),
        pagesize=LETTER,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.55 * inch,
    )
    story = [
        Paragraph("TSM FEMA Online LOMC / LOMA Evidence Packet", styles["Title"]),
        Paragraph(
            f"Case: {manifest['case_id']} · Status: {manifest['packet_status']}",
            styles["Normal"],
        ),
        Spacer(1, 12),
        Paragraph(
            "This PDF is an evidence index and cryptographic inventory generated "
            "from operator-supplied files. It is not a FEMA determination, FARA, "
            "survey certification, engineering certification, or submission approval.",
            styles["BodyText"],
        ),
        Spacer(1, 12),
    ]
    rows = [[Paragraph('<b>Path</b>', styles['BodyText']), Paragraph('<b>Bytes</b>', styles['BodyText']), Paragraph('<b>SHA-256</b>', styles['BodyText'])]]
    for item in manifest['source_files']:
        rows.append([Paragraph(str(item['path']), styles['BodyText']), str(item['bytes']), Paragraph(str(item['sha256']), styles['BodyText'])])
    table = Table(rows, repeatRows=1, colWidths=[3.2 * inch, 0.8 * inch, 3.0 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), None),
                ("GRID", (0, 0), (-1, -1), 0.35, None),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(table)
    story.extend(
        [
            Spacer(1, 14),
            Paragraph(
                "Human checklist: verify effective FIRM/FIS and applicable LOMC "
                "record in FEMA MSC; verify sealed survey, vertical datum/control, "
                "FIRMette, FARA/eFARA where required, community acknowledgment, "
                "and all property identifiers before submission.",
                styles["BodyText"],
            ),
        ]
    )
    doc.build(story)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", default="26-05-2022A")
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    if args.case != "26-05-2022A":
        raise SystemExit("fail-closed: this packet builder currently targets FEMA case 26-05-2022A")
    if not args.source_dir.is_dir():
        raise SystemExit(f"source directory does not exist: {args.source_dir}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest = build_manifest(args.case, args.source_dir)
    manifest_path = args.output_dir / "LOMA-26-05-2022A-manifest.json"
    pdf_path = args.output_dir / "LOMA-26-05-2022A-evidence-index.pdf"
    zip_path = args.output_dir / "LOMA-26-05-2022A-bundle.zip"

    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    build_pdf(manifest, pdf_path)

    with ZipFile(zip_path, "w", ZIP_DEFLATED) as bundle:
        bundle.write(manifest_path, manifest_path.name)
        bundle.write(pdf_path, pdf_path.name)
        for item in manifest["source_files"]:
            path = args.source_dir / item["path"]
            bundle.write(path, f"source/{item['path']}")

    print(json.dumps({
        "case_id": args.case,
        "manifest": str(manifest_path),
        "pdf": str(pdf_path),
        "bundle": str(zip_path),
        "source_count": len(manifest["source_files"]),
        "status": manifest["packet_status"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
