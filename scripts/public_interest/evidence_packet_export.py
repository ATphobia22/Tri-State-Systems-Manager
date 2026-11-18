#!/usr/bin/env python3
"""Civic Evidence Passport: offline DOCX/XLSX export of existing TSM passports.

Consumes JSON produced by scripts/public_interest/evidence_kit.py passport.
Uses minimal valid ISO Open XML zip packages (Python stdlib, not the .NET SDK).
Does not import parcel ownership, infer data values, or grant survey approval.
"""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
import math
from pathlib import Path
import re
import sys
from xml.etree import ElementTree as ET
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

PASSPORT_SCHEMA = "tsm.public-evidence.passport.v1"
RECEIPT_SCHEMA = "tsm.civic-evidence-passport.export-receipt.v1"
MAX_INPUT_BYTES = 2 * 1024 * 1024
SHA = re.compile(r"^[0-9a-f]{64}$")
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
P = "http://schemas.openxmlformats.org/package/2006/relationships"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
T = "http://schemas.openxmlformats.org/package/2006/content-types"
ET.register_namespace("w", W)
ET.register_namespace("r", R)


def clean(value: object, limit: int = 400) -> str:
    if value is None:
        return "NOT_EVIDENCED"
    if isinstance(value, bool):
        return str(value).upper()
    if not isinstance(value, (str, int, float)):
        raise ValueError("Non-scalar public passport value is not exportable")
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Non-finite public passport values are not exportable")
    text = str(value)
    if len(text) > limit or any((ord(ch) < 32 and ch not in "\t\n\r") or
                                ord(ch) in (0xFFFE, 0xFFFF) for ch in text):
        raise ValueError("Overlong or invalid XML text")
    return text


def load_passport(path: Path) -> tuple[dict, str]:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_INPUT_BYTES:
        raise ValueError("Passport must be a bounded regular JSON file")
    data = path.read_bytes()
    def unique_pairs(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise ValueError("Duplicate JSON key: " + key)
            out[key] = value
        return out
    doc = json.loads(data, object_pairs_hook=unique_pairs,
                     parse_constant=lambda x: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))
    if not isinstance(doc, dict) or doc.get("schema") != PASSPORT_SCHEMA:
        raise ValueError("Expected an existing TSM public evidence passport")
    expected = doc.get("integritySha256")
    if not isinstance(expected, str) or SHA.fullmatch(expected) is None:
        raise ValueError("Missing integrity digest")
    body = {k: v for k, v in doc.items() if k != "integritySha256"}
    computed = sha256(json.dumps(body, sort_keys=True, separators=(",", ":"),
                                ensure_ascii=True, allow_nan=False).encode()).hexdigest()
    if computed != expected:
        raise ValueError("Public passport integrity digest mismatch")
    for key in ("parcelId", "countyFips", "asOf", "snapshotId", "notice"):
        clean(doc.get(key))
    if doc.get("engineeringUse") is not False or doc.get("surveyCertification") is not False or doc.get("regulatoryDetermination") is not False:
        raise ValueError("Only explicitly informational passports are exportable")
    facts = doc.get("facts")
    if not isinstance(facts, list) or len(facts) > 500:
        raise ValueError("Unsupported fact list")
    allowed = ("label", "value", "units", "verticalDatum", "dataRole",
               "sourceId", "sourceSha256", "observedAt", "evidenceState")
    for fact in facts:
        if not isinstance(fact, dict):
            raise ValueError("Invalid fact")
        for key in allowed:
            clean(fact.get(key))
        if fact.get("valueIndependentlyValidated") is not False:
            raise ValueError("Fact must explicitly remain unvalidated")
    return doc, sha256(data).hexdigest()


def _xml(element: ET.Element) -> bytes:
    # OPC and SpreadsheetML parts require their own default namespace.
    # WordprocessingML remains explicitly prefixed with w: and r:.
    if element.tag.startswith("{"):
        namespace = element.tag[1:].split("}", 1)[0]
        if namespace in (P, T, S):
            ET.register_namespace("", namespace)
    return ET.tostring(element, encoding="utf-8", xml_declaration=True)


def _zwrite(archive: ZipFile, name: str, data: bytes) -> None:
    info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = ZIP_DEFLATED
    info.external_attr = 0o600 << 16
    archive.writestr(info, data)


def _root_rels(target: str) -> bytes:
    root = ET.Element(f"{{{P}}}Relationships")
    ET.SubElement(root, f"{{{P}}}Relationship",
                  {"Id": "rId1", "Type": R + "/officeDocument", "Target": target})
    return _xml(root)


def _types(content: str, target: str, workbook: bool = False) -> bytes:
    root = ET.Element(f"{{{T}}}Types")
    ET.SubElement(root, f"{{{T}}}Default",
                  {"Extension": "rels", "ContentType": "application/vnd.openxmlformats-package.relationships+xml"})
    ET.SubElement(root, f"{{{T}}}Default", {"Extension": "xml", "ContentType": "application/xml"})
    ET.SubElement(root, f"{{{T}}}Override", {"PartName": target, "ContentType": content})
    if workbook:
        ET.SubElement(root, f"{{{T}}}Override",
                      {"PartName": "/xl/worksheets/sheet1.xml",
                       "ContentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"})
    return _xml(root)


def docx_bytes(passport: dict) -> bytes:
    from io import BytesIO
    lines = [
        "Civic Evidence Passport — Informational Only",
        "Parcel: " + clean(passport["parcelId"]),
        "County FIPS: " + clean(passport["countyFips"]),
        "As of: " + clean(passport["asOf"]),
        "Snapshot: " + clean(passport["snapshotId"]),
        "Passport integrity SHA-256: " + clean(passport["integritySha256"]),
        clean(passport["notice"]),
        "Source bytes or data-provider labels do not independently verify a parcel join, a surveyed elevation, or regulatory applicability.",
    ]
    for index, fact in enumerate(passport["facts"], 1):
        lines.extend([
            f"Fact {index}: " + clean(fact["label"]),
            "Value: " + clean(fact.get("value")) + " | Units: " + clean(fact.get("units")),
            "State: " + clean(fact["evidenceState"]) + " | Role: " + clean(fact["dataRole"]),
            "Source: " + clean(fact["sourceId"]) + " | SHA-256: " + clean(fact.get("sourceSha256")),
            "Vertical datum: " + clean(fact.get("verticalDatum")) +
            " | Observed: " + clean(fact.get("observedAt")),
        ])
    doc = ET.Element(f"{{{W}}}document")
    body = ET.SubElement(doc, f"{{{W}}}body")
    for line in lines:
        paragraph = ET.SubElement(body, f"{{{W}}}p")
        run = ET.SubElement(paragraph, f"{{{W}}}r")
        text = ET.SubElement(run, f"{{{W}}}t")
        text.text = line
    ET.SubElement(body, f"{{{W}}}sectPr")
    stream = BytesIO()
    with ZipFile(stream, "w") as z:
        _zwrite(z, "[Content_Types].xml", _types("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "/word/document.xml"))
        _zwrite(z, "_rels/.rels", _root_rels("word/document.xml"))
        _zwrite(z, "word/document.xml", _xml(doc))
    return stream.getvalue()


def xlsx_bytes(passport: dict) -> bytes:
    from io import BytesIO
    sheet = ET.Element(f"{{{S}}}worksheet")
    data = ET.SubElement(sheet, f"{{{S}}}sheetData")
    rows = [
        ["Civic Evidence Passport", "Informational, not engineering certification"],
        ["Parcel ID", clean(passport["parcelId"])],
        ["County FIPS", clean(passport["countyFips"])],
        ["As of", clean(passport["asOf"])],
        ["Snapshot ID", clean(passport["snapshotId"])],
        ["Passport integrity SHA-256", clean(passport["integritySha256"])],
        ["Notice", clean(passport["notice"])],
        ["Label", "Value", "Units", "Vertical datum", "Role", "Source ID",
         "Source SHA-256", "Observed at", "Evidence state"],
    ]
    for fact in passport["facts"]:
        rows.append([clean(fact.get(k)) for k in (
            "label", "value", "units", "verticalDatum", "dataRole", "sourceId",
            "sourceSha256", "observedAt", "evidenceState")])
    def col(i: int) -> str:
        out = ""
        while i:
            i, rem = divmod(i - 1, 26)
            out = chr(65 + rem) + out
        return out
    for i, values in enumerate(rows, 1):
        r = ET.SubElement(data, f"{{{S}}}row", {"r": str(i)})
        for j, value in enumerate(values, 1):
            # Inline strings prevent user-supplied '=SUM(...)' and hyperlinks
            # becoming executable formulas or external network references.
            cell = ET.SubElement(r, f"{{{S}}}c", {"r": f"{col(j)}{i}", "t": "inlineStr"})
            inline = ET.SubElement(cell, f"{{{S}}}is")
            ET.SubElement(inline, f"{{{S}}}t").text = value
    workbook = ET.Element(f"{{{S}}}workbook", {f"{{{R}}}dummy": ""})
    workbook.attrib.pop(f"{{{R}}}dummy")
    sheets = ET.SubElement(workbook, f"{{{S}}}sheets")
    ET.SubElement(sheets, f"{{{S}}}sheet",
                  {"name": "Evidence", "sheetId": "1", f"{{{R}}}id": "rId1"})
    relationships = ET.Element(f"{{{P}}}Relationships")
    ET.SubElement(relationships, f"{{{P}}}Relationship",
                  {"Id": "rId1", "Type": R + "/worksheet", "Target": "worksheets/sheet1.xml"})
    stream = BytesIO()
    with ZipFile(stream, "w") as z:
        _zwrite(z, "[Content_Types].xml", _types("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml", "/xl/workbook.xml", True))
        _zwrite(z, "_rels/.rels", _root_rels("xl/workbook.xml"))
        _zwrite(z, "xl/workbook.xml", _xml(workbook))
        _zwrite(z, "xl/_rels/workbook.xml.rels", _xml(relationships))
        _zwrite(z, "xl/worksheets/sheet1.xml", _xml(sheet))
    return stream.getvalue()


def _output_path(prefix: Path, suffix: str) -> Path:
    """Append, rather than replace, any suffix in a parcel/version prefix."""
    return prefix.with_name(prefix.name + suffix)


def export(passport: dict, passport_sha256: str, prefix: Path) -> dict:
    docx = docx_bytes(passport)
    xlsx = xlsx_bytes(passport)
    receipt = {
        "schema": RECEIPT_SCHEMA,
        "passportSchema": PASSPORT_SCHEMA,
        "parcelId": clean(passport["parcelId"]),
        "snapshotId": clean(passport["snapshotId"]),
        "inputPassportFileSha256": passport_sha256,
        "passportIntegritySha256": passport["integritySha256"],
        "outputs": {
            "docx": {"name": prefix.name + ".docx", "sha256": sha256(docx).hexdigest()},
            "xlsx": {"name": prefix.name + ".xlsx", "sha256": sha256(xlsx).hexdigest()},
        },
        "regulatoryDetermination": False, "surveyCertification": False,
        "sourceValueIndependentlyValidated": False,
        "notice": "Hashes bind local generated bytes, not scientific or agency certification.",
    }
    paths = [_output_path(prefix, extension)
             for extension in (".docx", ".xlsx", ".receipt.json")]
    if len({p.resolve() for p in paths}) != 3 or any(p.exists() for p in paths):
        raise ValueError("Export output collision: existing files will not be overwritten")
    prefix.parent.mkdir(parents=True, exist_ok=True)
    contents = [docx, xlsx, (json.dumps(receipt, indent=2, ensure_ascii=False) + "\n").encode()]
    created: list[Path] = []
    try:
        for path, payload in zip(paths, contents):
            with path.open("xb") as stream:
                created.append(path)
                stream.write(payload)
    except BaseException:
        for path in created:
            path.unlink(missing_ok=True)
        raise
    return receipt


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--passport", required=True, type=Path)
    p.add_argument("--out-prefix", required=True, type=Path)
    args = p.parse_args(argv)
    try:
        if args.passport.resolve() in {_output_path(args.out_prefix, x).resolve()
                                      for x in (".docx", ".xlsx", ".receipt.json")}:
            raise ValueError("Output must not replace the source passport")
        data, digest = load_passport(args.passport)
        receipt = export(data, digest, args.out_prefix)
    except (ValueError, OSError, TypeError, KeyError) as exc:
        print("Civic Evidence Passport export failed: " + str(exc), file=sys.stderr)
        return 2
    print("Exported locally: " + ", ".join(v["name"] for v in receipt["outputs"].values()))
    print("INFORMATIONAL_ONLY: no datum/survey/regulatory certification")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
