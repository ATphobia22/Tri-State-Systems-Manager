#!/usr/bin/env python3
"""Static audit of reachable local 3D Tiles references; not runtime verification."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import unquote, urlsplit


def clean_uri(value: str) -> str:
    if not isinstance(value, str) or not value or any(ord(c) < 32 for c in value):
        raise ValueError("invalid tile content URI")
    parts = urlsplit(value)
    if parts.scheme or parts.netloc or parts.query or parts.fragment:
        raise ValueError("remote/query URI disallowed: " + value)
    decoded = unquote(value)
    if decoded.startswith(("/", "\\")) or "\\" in decoded or ":" in decoded:
        raise ValueError("absolute/nonportable URI disallowed: " + value)
    if any(p in ("", ".", "..") for p in decoded.split("/")):
        raise ValueError("traversal/noncanonical URI disallowed: " + value)
    return decoded


def audit(root: Path, index: Path) -> dict:
    root = root.resolve(strict=True)
    if not root.is_dir() or index.is_symlink():
        raise ValueError("unsafe staged root or index")
    index = index.resolve(strict=True)
    if index.name != "tileset.json" or not index.is_relative_to(root):
        raise ValueError("tileset index must be within staged root")
    seen: set[Path] = set()
    content_files: set[Path] = set()

    def asset(parent: Path, uri: str) -> Path:
        candidate = parent / clean_uri(uri)
        if not candidate.is_relative_to(root):
            raise ValueError("asset escapes staged root")
        cursor = root
        for component in candidate.relative_to(root).parts:
            cursor = cursor / component
            if cursor.is_symlink():
                raise ValueError("symlink tile content disallowed")
        if not candidate.is_file() or not candidate.resolve().is_relative_to(root):
            raise ValueError("missing/unsafe local tile content: " + uri)
        return candidate

    def visit(path: Path) -> None:
        if path in seen:
            return
        seen.add(path)
        try:
            obj = json.loads(path.read_text(encoding="utf-8"))
        except (UnicodeError, json.JSONDecodeError) as exc:
            raise ValueError("invalid tileset JSON") from exc
        if not isinstance(obj, dict) or not isinstance(obj.get("root"), dict):
            raise ValueError("tileset root must be an object")

        def node(value: object) -> None:
            if not isinstance(value, dict):
                raise ValueError("invalid tile object")
            for key in ("content", "contents"):
                if key not in value:
                    continue
                records = value[key] if key == "contents" else [value[key]]
                if not isinstance(records, list) or any(not isinstance(r, dict) for r in records):
                    raise ValueError("invalid tile content records")
                for record in records:
                    uri = record.get("uri", record.get("url"))
                    if uri is None:
                        continue
                    f = asset(path.parent, uri)
                    if f.suffix.lower() == ".json":
                        visit(f)
                    else:
                        content_files.add(f)
            children = value.get("children", [])
            if not isinstance(children, list):
                raise ValueError("invalid children")
            for child in children:
                node(child)
        node(obj["root"])

    visit(index)
    inventory = []
    for file in sorted(seen | content_files, key=lambda p: p.relative_to(root).as_posix()):
        digest = hashlib.sha256()
        with file.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        inventory.append({"path": file.relative_to(root).as_posix(),
                          "bytes": file.stat().st_size, "sha256": digest.hexdigest()})
    return {"schema": "tsm.native.local-3dtiles-static-audit.v1",
            "status": "STATIC_REFERENCES_VERIFIED", "releaseCertified": False,
            "offlineRuntimeVerified": False, "tilesets": len(seen),
            "payloads": len(content_files), "files": inventory}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--tileset", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = audit(args.root, args.tileset)
    if args.output:
        destination = args.output.resolve()
        if destination.is_relative_to(args.root.resolve()):
            raise ValueError("report must be outside immutable staged root")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "files"}))


if __name__ == "__main__":
    main()
