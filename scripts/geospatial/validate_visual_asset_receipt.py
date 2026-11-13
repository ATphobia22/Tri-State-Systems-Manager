#!/usr/bin/env python3
"""Provenance gate for optional Blender/3D Tiles visual assets; not a 3D Tiles validator."""
import argparse
import hashlib
import json
import re
from pathlib import Path

REQUIRED = ("schema", "asset", "sha256", "source_uri", "license",
            "horizontal_frame", "vertical_datum", "coordinate_epoch",
            "units", "authority_class", "transformation_status", "visualization_only")

class ReceiptError(ValueError):
    pass

def validate(receipt_path: Path, root: Path) -> dict:
    root = root.resolve(strict=True)
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    if not isinstance(receipt, dict):
        raise ReceiptError("Receipt must be a JSON object")
    missing = [field for field in REQUIRED if field not in receipt]
    if missing:
        raise ReceiptError("Missing receipt fields: " + ", ".join(missing))
    if receipt["schema"] != "tsm.visual-asset-receipt.v1":
        raise ReceiptError("Unsupported receipt schema")
    rel = receipt["asset"]
    if not isinstance(rel, str) or not rel or "\\" in rel or ":" in rel or rel.startswith("/"):
        raise ReceiptError("Asset must be a local relative POSIX path")
    if any(part in ("..", ".", "") for part in rel.split("/")):
        raise ReceiptError("Asset path traversal")
    asset = root.joinpath(*Path(rel).parts)
    if (not asset.is_file() or any(part.is_symlink() for part in (asset, *asset.parents) if part != root)
            or not asset.resolve().is_relative_to(root)):
        raise ReceiptError("Asset missing, symlinked, or outside staged root")
    if not isinstance(receipt["sha256"], str) or re.fullmatch(r"[0-9a-fA-F]{64}", receipt["sha256"]) is None:
        raise ReceiptError("Invalid SHA-256 digest")
    with asset.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != receipt["sha256"].lower():
        raise ReceiptError("Asset checksum mismatch")
    for field in ("source_uri", "license", "horizontal_frame", "vertical_datum",
                  "units", "authority_class", "transformation_status"):
        if not isinstance(receipt[field], str) or not receipt[field].strip():
            raise ReceiptError("Missing or empty metadata: " + field)
    epoch = receipt["coordinate_epoch"]
    if epoch is not None and (isinstance(epoch, bool) or not isinstance(epoch, (int, float))
                              or not 1900 <= epoch <= 2200):
        raise ReceiptError("Invalid coordinate epoch")
    if receipt["visualization_only"] is not True:
        raise ReceiptError("Visual assets must be visualization_only")
    if receipt["authority_class"] not in ("SOURCE_REFERENCE", "DERIVED", "EXPERIMENTAL_BETA"):
        raise ReceiptError("Unsupported authority class")
    if receipt["transformation_status"] not in ("NOT_APPLIED", "DOCUMENTED", "UNVERIFIED"):
        raise ReceiptError("Unsupported transformation status")
    return {"status": "VISUALIZATION_RECEIPT_VERIFIED", "sha256": digest,
            "beta_operational_use_prohibited": receipt["authority_class"] == "EXPERIMENTAL_BETA",
            "asset": rel}

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("receipt", type=Path)
    parser.add_argument("--root", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(validate(args.receipt, args.root), sort_keys=True))
    except (ReceiptError, OSError, ValueError) as exc:
        parser.exit(2, f"receipt rejected: {exc}\n")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
