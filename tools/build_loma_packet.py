"""Build a deterministic LOMA evidence packet.

The packet is an evidence bundle, not a FEMA certification, engineering seal,
grant application, permit, or regulatory determination.

When TSM_EVIDENCE_SIGNING_KEY_PEM is present, the manifest is detached-signed
with the repository's Ed25519 signer. Production/release callers can require
that signature with --require-signature.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import subprocess
import zipfile
from pathlib import Path
from typing import Iterable

SCHEMA = "tsm.loma-evidence-packet.v1"
EPOCH = (1980, 1, 1, 0, 0, 0)
REPO_ROOT = Path(__file__).resolve().parents[1]
SIGNER = REPO_ROOT / "scripts" / "evidence" / "sign-evidence.mjs"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_path(path: Path) -> str:
    absolute = path.resolve()
    try:
        relative = absolute.relative_to(REPO_ROOT)
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


def build_manifest(paths: list[Path], signature_status: str) -> dict:
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
        "signature_status": signature_status,
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
    return manifest


def sign_manifest(manifest_path: Path, signature_path: Path, require: bool) -> bool:
    key_present = bool(os.environ.get("TSM_EVIDENCE_SIGNING_KEY_PEM"))
    if not key_present:
        if require:
            raise RuntimeError(
                "TSM_EVIDENCE_SIGNING_KEY_PEM is required for a signed production packet"
            )
        return False

    if not SIGNER.is_file():
        raise FileNotFoundError(f"detached signer not found: {SIGNER}")

    subprocess.run(
        [
            "node",
            str(SIGNER),
            str(manifest_path),
            str(signature_path),
        ],
        cwd=REPO_ROOT,
        check=True,
    )
    if not signature_path.is_file() or signature_path.stat().st_size == 0:
        raise RuntimeError("detached signer completed without producing a signature")
    return True


def build_packet(
    inputs: list[Path],
    output: Path,
    *,
    require_signature: bool = False,
) -> None:
    output = output.resolve()
    paths = collect(inputs, output)
    output.parent.mkdir(parents=True, exist_ok=True)

    # The manifest is signed before it is inserted into the deterministic ZIP.
    # The signature file is therefore never part of the manifest being signed.
    temporary_manifest = output.with_suffix(output.suffix + ".manifest.json")
    temporary_signature = output.with_suffix(output.suffix + ".manifest.sig")
    signature_enabled = bool(os.environ.get("TSM_EVIDENCE_SIGNING_KEY_PEM"))

    try:
        manifest = build_manifest(
            paths,
            "SIGNED" if signature_enabled else "UNSIGNED",
        )
        manifest_bytes = json.dumps(
            manifest,
            sort_keys=True,
            indent=2,
        ).encode() + b"\n"
        temporary_manifest.write_bytes(manifest_bytes)

        signed = sign_manifest(
            temporary_manifest,
            temporary_signature,
            require_signature,
        )

        if signed and manifest["signature_status"] != "SIGNED":
            raise RuntimeError("signature state changed after manifest construction")
        if not signed and manifest["signature_status"] == "SIGNED":
            raise RuntimeError("manifest claims SIGNED but no signature was produced")

        with zipfile.ZipFile(
            output,
            "w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=9,
        ) as archive:
            info = zipfile.ZipInfo("manifest.json", EPOCH)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(info, manifest_bytes)

            if signed:
                info = zipfile.ZipInfo("manifest.sig", EPOCH)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (stat.S_IFREG | 0o600) << 16
                archive.writestr(info, temporary_signature.read_bytes())

            for path, record in zip(paths, manifest["files"]):
                info = zipfile.ZipInfo(record["path"], EPOCH)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                archive.writestr(info, path.read_bytes())
    finally:
        temporary_manifest.unlink(missing_ok=True)
        temporary_signature.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("-o", "--output", type=Path, required=True)
    parser.add_argument(
        "--require-signature",
        action="store_true",
        help="fail unless TSM_EVIDENCE_SIGNING_KEY_PEM signs the manifest",
    )
    parser.add_argument("inputs", nargs="+", type=Path)
    args = parser.parse_args()
    build_packet(
        args.inputs,
        args.output,
        require_signature=args.require_signature,
    )


if __name__ == "__main__":
    main()
