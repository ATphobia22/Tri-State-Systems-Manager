"""Build a deterministic LOMA evidence packet.

The packet is an evidence bundle, not a FEMA certification, engineering seal,
grant application, permit, or regulatory determination.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import stat
import zipfile
from pathlib import Path
from typing import Iterable

SCHEMA = "tsm.loma-evidence-packet.v1"
EPOCH = (1980, 1, 1, 0, 0, 0)
ROOT = Path.cwd().resolve()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_path(path: Path) -> str:
    absolute = path.resolve()
    try:
        relative = absolute.relative_to(ROOT)
    except ValueError as exc:
        raise ValueError(
            f"packet path must remain inside repository root: {path}"
        ) from exc

    if not relative.parts:
        raise ValueError(f"invalid packet path: {path}")

    return relative.as_posix()


def collect(inputs: Iterable[Path], output: Path) -> list[Path]:
    output = output.resolve()
    files: list[Path] = []

    for item in inputs:
        resolved = item.resolve()
        if resolved == output:
            raise ValueError(f"packet output must not also be an input: {item}")

        if item.is_file():
            files.append(item)
        elif item.is_dir():
            for candidate in item.rglob("*"):
                if not candidate.is_file():
                    continue
                if candidate.resolve() == output:
                    continue
                files.append(candidate)
        else:
            raise FileNotFoundError(item)

    unique = {path.resolve(): path for path in files}
    for path in unique:
        stable_path(path)

    return sorted(unique.values(), key=stable_path)


def build_packet(inputs: list[Path], output: Path) -> None:
    output = output.resolve()
    paths = collect(inputs, output)
    records = [
        {
            "path": stable_path(path),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
        for path in paths
    ]

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
    canonical = json.dumps(
        manifest,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()
    manifest["manifest_sha256"] = hashlib.sha256(canonical).hexdigest()

    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(
        output,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
    ) as archive:
        info = zipfile.ZipInfo("manifest.json", EPOCH)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        archive.writestr(
            info,
            json.dumps(manifest, sort_keys=True, indent=2) + "\n",
        )

        for path, record in zip(paths, records):
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
