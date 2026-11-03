#!/usr/bin/env python3
"""Informational-only public publication-risk inventory, with no identifier output.

Scans tracked candidate-public files. Never log matching text, precise geometry,
parcel IDs or filenames. This cannot certify privacy or authorize publication.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from collections import Counter
from pathlib import Path

ROOTS = (
    "tsm-console/public/",
    "tsm-console/src/",
    "docs/",
    "data/",
    "artifacts/",
)
MAX_BYTES = 2 * 1024 * 1024
TEXT_SUFFIXES = {
    ".json", ".geojson", ".md", ".txt", ".ts", ".tsx", ".js", ".mjs",
    ".py", ".csv", ".yml", ".yaml", ".html", ".xml", ".sql", ".svg",
}
PATTERNS = {
    "street_address_syntax": re.compile(
        r"\b\d{1,6}\s+[A-Za-z][A-Za-z0-9.'-]{2,}"
        r"(?:\s+[A-Za-z][A-Za-z0-9.'-]{2,}){0,4}"
        r"\s+(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Lane|Ln|Court|Ct|Highway|Hwy)\b",
        re.IGNORECASE,
    ),
    "precise_coordinate_pair": re.compile(
        r"(?<!\d)-?\d{1,3}\.\d{6,}\s*[,;]\s*-?\d{1,3}\.\d{6,}(?!\d)"
    ),
    "parcel_identifier_value": re.compile(
        r"\b(?:parcel[_ -]?id|parcel[_ -]?number|property[_ -]?id)\b"
        r'\s*["\x27:= ]+\s*[A-Za-z0-9][A-Za-z0-9._-]{7,}',
        re.IGNORECASE,
    ),
    "private_site_label": re.compile(
        r"\bprivate[_ -]?(?:residence|parcel|site)[_ -]?(?:anchor|identifier)\b",
        re.IGNORECASE,
    ),
}


def classify_text(text: str) -> set[str]:
    """Return only category names. No matched value or context is retained."""
    return {name for name, pattern in PATTERNS.items() if pattern.search(text)}


def inventory(root: Path, relative_files: list[str]) -> dict:
    counts: Counter[str] = Counter()
    skipped: Counter[str] = Counter()
    checked = 0
    flags = 0
    seen: set[str] = set()
    for rel in sorted(relative_files):
        if rel in seen:
            continue
        seen.add(rel)
        if not any(rel.startswith(prefix) for prefix in ROOTS):
            continue
        path = root / rel
        if path.is_symlink():
            skipped["symlinks"] += 1
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES:
            skipped["nontext_or_binary_format"] += 1
            continue
        try:
            if not path.is_file():
                skipped["missing_or_nonfile"] += 1
                continue
            if path.stat().st_size > MAX_BYTES:
                skipped["oversized"] += 1
                continue
            raw = path.read_bytes()
        except OSError:
            skipped["unreadable"] += 1
            continue
        if b"\0" in raw:
            skipped["binary_bytes"] += 1
            continue
        checked += 1
        categories = classify_text(raw.decode("utf-8", errors="replace"))
        if categories:
            flags += 1
        for name in categories:
            counts[name] += 1
    return {
        "schemaVersion": "tsm.publication-risk-aggregate.v1",
        "status": "OWNER_PRIVACY_REVIEW_REQUIRED",
        "publicationApproved": False,
        "historyOrPagesScanned": False,
        "binaryMetadataInspected": False,
        "note": "Heuristic category counts only. Absence of flags does not authorize publication.",
        "candidateFilesChecked": checked,
        "filesWithPotentialIndicators": flags,
        "indicatorFileCounts": dict(sorted(counts.items())),
        "excludedFileCounts": dict(sorted(skipped.items())),
    }


def tracked_paths(root: Path) -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z", "--", *ROOTS],
        cwd=root, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    return [p.decode("utf-8", errors="replace") for p in result.stdout.split(b"\0") if p]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = inventory(args.root, tracked_paths(args.root))
    content = json.dumps(report, sort_keys=True, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(content, encoding="utf-8")
    print(content, end="")  # aggregates only, never matching values/paths
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
