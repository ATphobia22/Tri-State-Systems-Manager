#!/usr/bin/env python3
"""Fast-lane LOMA additional-information response checklist validator.

Reads a case-response package directory containing a ``case.json`` manifest
plus the artifact files it references, and checks each FEMA
additional-information item from the local floodplain admin packet:

  1. recorded deed/plat present
  2. tax assessor map (with street intersection on the FIRM panel) present
  3. PE/RLS-certified elevation documentation present, certified, and not expired
     (MT-1 Form 2 / Elevation Certificate)
  4. written FEMA confirmation of the accepted form/procedure present
  5. original FEMA PDF preserved byte-identically (SHA-256 vs control hash)

Plus deadline math for the 90-day response track.

Fail-closed: the overall verdict is READY only when every item is PASS.
Any FAIL or MISSING item yields NOT_READY. This tool never decides whether
a document satisfies FEMA; it only checks package completeness. Human
authority remains final. Not legal advice.

Package layout::

    <package-dir>/
      case.json          # manifest (see CASE_JSON_SCHEMA below)
      deed.pdf
      assessor-map.pdf
      elevation-cert.pdf
      fema-confirmation.pdf
      26-05-2022A-092226.pdf   # original FEMA correspondence (immutable)

Usage:
    python3 tools/validation/fastlane_loma_checklist.py <package-dir> [--as-of YYYY-MM-DD]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

CHUNK_SIZE = 1024 * 1024

# Checklist items, in packet order. Key = manifest item key.
CHECKLIST: tuple[tuple[str, str], ...] = (
    ("deed_plat", "Recorded deed/plat"),
    ("assessor_map", "Tax assessor map (street intersection on FIRM panel)"),
    ("elevation_doc", "PE/RLS-certified elevation documentation (MT-1 Form 2 / Elevation Certificate)"),
    ("fema_form_confirmation", "Written FEMA confirmation of accepted form/procedure"),
    ("original_fema_pdf", "Original FEMA PDF preserved byte-identically"),
)

CASE_JSON_SCHEMA = {
    "case_id": "e.g. 26-05-2022A (string, required)",
    "fema_letter_date": "YYYY-MM-DD of the FEMA additional-information letter (required)",
    "response_deadline": "YYYY-MM-DD, end of the 90-day track (required)",
    "control_sha256": "SHA-256 of the original FEMA PDF at intake (optional but recommended)",
    "items": {
        "<key>": {
            "file": "filename inside the package dir",
            "certified_by": "PE | RLS (elevation_doc only)",
            "expires": "YYYY-MM-DD certification expiry (elevation_doc only, optional)",
        }
    },
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_iso_day(value: str) -> date | None:
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def check_item(key: str, entry: dict[str, Any] | None, package_dir: Path,
               manifest: dict[str, Any]) -> dict[str, Any]:
    """Check one checklist item. Returns {key, label, status, detail}."""
    label = dict(CHECKLIST)[key]
    if not entry or not entry.get("file"):
        return {"key": key, "label": label, "status": "MISSING",
                "detail": "no file referenced in case.json"}
    artifact = package_dir / entry["file"]
    if not artifact.is_file():
        return {"key": key, "label": label, "status": "MISSING",
                "detail": f"referenced file not found: {entry['file']}"}

    if key == "elevation_doc":
        certified_by = str(entry.get("certified_by", "")).upper()
        if certified_by not in ("PE", "RLS"):
            return {"key": key, "label": label, "status": "FAIL",
                    "detail": "elevation document present but not marked PE/RLS-certified"}
        expiry = parse_iso_day(entry.get("expires", ""))
        if entry.get("expires") and expiry is None:
            return {"key": key, "label": label, "status": "FAIL",
                    "detail": f"unparseable certification expiry: {entry.get('expires')}"}
        if expiry and expiry < date.today():
            return {"key": key, "label": label, "status": "FAIL",
                    "detail": f"certification expired {expiry.isoformat()}"}
        detail = f"present, {certified_by}-certified"
        if expiry:
            detail += f", expires {expiry.isoformat()}"
        return {"key": key, "label": label, "status": "PASS", "detail": detail}

    if key == "original_fema_pdf":
        control = manifest.get("control_sha256")
        actual = sha256_file(artifact)
        if control and actual.lower() != str(control).lower():
            return {"key": key, "label": label, "status": "FAIL",
                    "detail": "SHA-256 does not match control hash — original may have been altered"}
        detail = f"present, sha256={actual}"
        if control:
            detail += " (matches control)"
        return {"key": key, "label": label, "status": "PASS", "detail": detail}

    return {"key": key, "label": label, "status": "PASS",
            "detail": f"present: {entry['file']}"}


def run_checklist(package_dir: Path, as_of: date) -> dict[str, Any]:
    manifest_path = package_dir / "case.json"
    if not manifest_path.is_file():
        return {"package_dir": str(package_dir), "error": "case.json not found",
                "verdict": "NOT_READY"}

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        return {"package_dir": str(package_dir),
                "error": f"case.json unreadable: {exc}", "verdict": "NOT_READY"}

    items = manifest.get("items", {})
    results = [check_item(key, items.get(key), package_dir, manifest)
               for key, _ in CHECKLIST]

    letter_date = parse_iso_day(manifest.get("fema_letter_date", ""))
    deadline = parse_iso_day(manifest.get("response_deadline", ""))
    deadline_info: dict[str, Any] = {
        "fema_letter_date": manifest.get("fema_letter_date"),
        "response_deadline": manifest.get("response_deadline"),
        "days_remaining": (deadline - as_of).days if deadline else None,
        "track_status": "UNKNOWN",
    }
    if deadline:
        days = (deadline - as_of).days
        deadline_info["track_status"] = "EXPIRED" if days < 0 else "OPEN"

    failed = [r for r in results if r["status"] != "PASS"]
    verdict = "READY" if not failed else "NOT_READY"
    return {
        "case_id": manifest.get("case_id"),
        "package_dir": str(package_dir),
        "as_of": as_of.isoformat(),
        "items": results,
        "deadline": deadline_info,
        "verdict": verdict,
        "verdict_note": (
            "All checklist items present and valid; package completeness only — "
            "a human must review and submit."
            if verdict == "READY"
            else "Fail-closed: one or more items are FAIL/MISSING. Do not submit."
        ),
        "disclaimer": (
            "Completeness check only. This tool does not determine whether any "
            "document satisfies FEMA requirements. Not legal advice. "
            "Human authority remains final."
        ),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate a LOMA additional-information response package.")
    parser.add_argument("package_dir", help="Directory with case.json + artifacts.")
    parser.add_argument("--as-of", default=None,
                        help="Reference date YYYY-MM-DD for deadline math (default: today).")
    parser.add_argument("--print-schema", action="store_true",
                        help="Print the expected case.json schema and exit.")
    args = parser.parse_args(argv)

    if args.print_schema:
        print(json.dumps(CASE_JSON_SCHEMA, indent=2))
        return 0

    as_of = parse_iso_day(args.as_of) if args.as_of else date.today()
    if as_of is None:
        print("error: --as-of must be YYYY-MM-DD", file=sys.stderr)
        return 2

    result = run_checklist(Path(args.package_dir), as_of)
    print(json.dumps(result, indent=2))
    return 0 if result.get("verdict") == "READY" else 1


if __name__ == "__main__":
    raise SystemExit(main())
