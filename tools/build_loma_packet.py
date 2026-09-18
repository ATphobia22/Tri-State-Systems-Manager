"""Build a deterministic LOMA evidence packet.

The packet is an evidence bundle, not a FEMA certification, engineering seal,
grant application, permit, or regulatory determination.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import zipfile
from pathlib import Path
from typing import Iterable

SCHEMA = "tsm.loma-evidence-packet.v1"
EPOCH = (1980, 1, 1, 0, 0, 0)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def collect(inputs: Iterable[Path]) -> list[Path]:
    files: list[Path] = []
    for item in inputs:
        if item.is_file():
            files.append(item)
        elif item.is_dir():
            files.extend(p for p in item.rglob("*") if p.is_file())
        else:
            raise FileNotFoundError(item)
    return sorted(set(files), key=lambda p: p.as_posix())


def build_packet(inputs: list[Path], output: Path) -> None:
    output = output.resolve()
    records = []
    for path in collect(inputs):
        resolved = path.resolve()
        if resolved == output:
            continue
        records.append({
            "path": path.as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        })

    manifest = {
        "schema": SCHEMA,
        "algorithm": "SHA-256",
        "artifact_class": "EVIDENCE_BUNDLE",
        "certification_status": "NOT_CERTIFIED",
        "boundaries": [
            "Not a FEMA certification or determination.",
            "Not a signed/sealed engineering deliverable.",
            "Not a grant eligibility, award, or compliance determination.",
            "Source observations remain subject to authoritative-source verification.",
        ],
        "files": records,
    }
    canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    manifest["manifest_sha256"] = hashlib.sha256(canonical).hexdigest()

    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        info = zipfile.ZipInfo("manifest.json", EPOCH)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        archive.writestr(info, json.dumps(manifest, sort_keys=True, indent=2) + "\n")
        for path, record in zip(zip([p for p in collect(inputs) if p.resolve() != output], records), records):
            info = zipfile.ZipInfo(record["path"], EPOCH)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(info, path.read_bytes())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("-o", "--output", type=Path, required=True)
    parser.add_argument("inputs", nargs="+", type=Path)
    args = parser.parse_args()
    build_packet(args.inputs, args.output)


if __name__ == "__main__":
    main()
