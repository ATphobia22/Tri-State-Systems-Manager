"""Deterministic RFC 9162 SHA-256 Merkle evidence commitments for TSM.

Leaves encode ROLE, repo/dossier-relative PATH, raw-file SHA-256 and byte count
as sorted compact UTF-8 JSON. This TSM leaf payload profile uses RFC 9162's
domain-separated tree algorithm; it is not an RFC 9162 CT log service.

Integrity and inclusion are NOT source authenticity, professional review,
survey control, regulatory approval, or protection from a dishonest root signer.
Anchor tree roots in an independently controlled, authenticated release record.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
from pathlib import Path, PurePosixPath
from typing import Any

VERSION = "tsm.merkle-evidence.v1"
ALGORITHM = "RFC9162-SHA256"
_HEX = re.compile(r"^[0-9a-f]{64}$")


def canonical(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
                      allow_nan=False).encode("utf-8")


def _sha(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def _node(left: bytes, right: bytes) -> bytes:
    return _sha(b"\\x01" + left + right)


def _leaf(data: bytes) -> bytes:
    return _sha(b"\\x00" + data)


def _cut(size: int) -> int:
    if size < 2:
        raise ValueError("TREE_NEEDS_AT_LEAST_TWO_LEAVES")
    return 1 << ((size - 1).bit_length() - 1)


def tree_hash(entries: list[bytes]) -> bytes:
    if not entries:
        return _sha(b"")
    if len(entries) == 1:
        return _leaf(entries[0])
    k = _cut(len(entries))
    return _node(tree_hash(entries[:k]), tree_hash(entries[k:]))


def inclusion_path(entries: list[bytes], index: int) -> list[dict[str, str]]:
    if type(index) is not int or not 0 <= index < len(entries):
        raise ValueError("MERKLE_INDEX_OUT_OF_BOUNDS")
    if len(entries) == 1:
        return []
    k = _cut(len(entries))
    if index < k:
        return inclusion_path(entries[:k], index) + [
            {"side": "right", "sha256": tree_hash(entries[k:]).hex()}]
    return inclusion_path(entries[k:], index - k) + [
        {"side": "left", "sha256": tree_hash(entries[:k]).hex()}]


def verify_inclusion(leaf_payload: bytes, index: int, tree_size: int,
                     proof: list[dict[str, str]], root_sha256: str) -> bool:
    if (type(index) is not int or type(tree_size) is not int
            or not (0 <= index < tree_size) or not isinstance(proof, list)
            or not isinstance(root_sha256, str) or not _HEX.fullmatch(root_sha256)):
        return False
    try:
        def walk(size: int, offset: int, remaining: list[dict]) -> bytes:
            if size == 1:
                return _leaf(leaf_payload)
            k = _cut(size)
            if offset < k:
                child = walk(k, offset, remaining)
                side = "right"
            else:
                child = walk(size - k, offset - k, remaining)
                side = "left"
            if not remaining:
                raise ValueError("MISSING_PROOF_NODE")
            node = remaining.pop(0)
            if (not isinstance(node, dict) or set(node) != {"side", "sha256"}
                    or node["side"] != side or not isinstance(node["sha256"], str)
                    or not _HEX.fullmatch(node["sha256"])):
                raise ValueError("INVALID_PROOF_NODE")
            other = bytes.fromhex(node["sha256"])
            return _node(child, other) if side == "right" else _node(other, child)

        remaining = list(proof)
        digest = walk(tree_size, index, remaining)
        return not remaining and digest.hex() == root_sha256
    except (TypeError, ValueError, KeyError):
        return False


def _safe_path(root: Path, path: str) -> Path:
    if (not isinstance(path, str) or not path or "\\\\" in path
            or "\\x00" in path or path.startswith("/")
            or PurePosixPath(path).is_absolute()
            or any(part in ("", ".", "..") for part in path.split("/"))):
        raise ValueError("UNSAFE_EVIDENCE_PATH")
    node = root
    for part in path.split("/"):
        node = node / part
        if node.is_symlink():
            raise ValueError("SYMLINK_EVIDENCE_FORBIDDEN")
    if not node.is_file() or not stat.S_ISREG(node.stat().st_mode):
        raise ValueError("EVIDENCE_FILE_NOT_REGULAR")
    if not node.resolve().is_relative_to(root.resolve()):
        raise ValueError("EVIDENCE_PATH_ESCAPED_ROOT")
    return node


def file_digest(path: Path) -> tuple[str, int]:
    h = hashlib.sha256()
    count = 0
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            count += len(block)
            h.update(block)
    return h.hexdigest(), count


def _valid_item(item: dict) -> None:
    if not isinstance(item, dict) or set(item) != {"role", "path", "sha256", "byteLength"}:
        raise ValueError("MERKLE_ITEM_SCHEMA_INVALID")
    if (not isinstance(item["role"], str) or not re.fullmatch(r"[a-z][a-z0-9_-]{0,63}", item["role"])
            or not isinstance(item["sha256"], str) or not _HEX.fullmatch(item["sha256"])
            or type(item["byteLength"]) is not int or item["byteLength"] < 0):
        raise ValueError("MERKLE_ITEM_VALUE_INVALID")
    # syntactic check; does not open a file until verify_manifest
    path = item["path"]
    if (not isinstance(path, str) or not path or "\\\\" in path or "\\x00" in path
            or path.startswith("/") or any(part in ("", ".", "..") for part in path.split("/"))):
        raise ValueError("UNSAFE_EVIDENCE_PATH")


def build_manifest(root: Path, artifacts: list[tuple[str, str]]) -> dict:
    """Hash the actual named local files; never substitute declared digests."""
    if not artifacts:
        raise ValueError("NO_EVIDENCE_ARTIFACTS")
    records = []
    for role, path in artifacts:
        path_obj = _safe_path(Path(root), path)
        digest, count = file_digest(path_obj)
        entry = {"role": role, "path": path, "sha256": digest, "byteLength": count}
        _valid_item(entry)
        records.append(entry)
    records.sort(key=lambda item: (item["role"], item["path"]))
    keys = [(r["role"], r["path"]) for r in records]
    if len(set(keys)) != len(keys):
        raise ValueError("DUPLICATE_EVIDENCE_ARTIFACT")
    return {
        "schemaVersion": VERSION, "algorithm": ALGORITHM, "leafCount": len(records),
        "items": records,
        "merkleRootSha256": tree_hash([canonical(x) for x in records]).hex(),
        "regulatoryApproval": False,
        "trustBoundary": "Integrity only. Root authenticity, source origin, survey and agency approvals require separate evidence.",
    }


def verify_manifest(root: Path, manifest: dict) -> bool:
    """Require original artifact bytes AND exactly recomputed tree root."""
    try:
        if (not isinstance(manifest, dict)
                or set(manifest) != {"schemaVersion", "algorithm", "leafCount", "items",
                                     "merkleRootSha256", "regulatoryApproval", "trustBoundary"}
                or manifest["schemaVersion"] != VERSION or manifest["algorithm"] != ALGORITHM
                or manifest["regulatoryApproval"] is not False
                or not isinstance(manifest["trustBoundary"], str)):
            return False
        items = manifest["items"]
        if not isinstance(items, list) or not items or type(manifest["leafCount"]) is not int or len(items) != manifest["leafCount"]:
            return False
        if any(not isinstance(x, dict) for x in items):
            return False
        for item in items:
            _valid_item(item)
        if items != sorted(items, key=lambda item: (item["role"], item["path"])):
            return False
        if len({(x["role"], x["path"]) for x in items}) != len(items):
            return False
        for item in items:
            digest, size = file_digest(_safe_path(Path(root), item["path"]))
            if digest != item["sha256"] or size != item["byteLength"]:
                return False
        return tree_hash([canonical(x) for x in items]).hex() == manifest["merkleRootSha256"]
    except (OSError, KeyError, TypeError, ValueError):
        return False


def prove_item(manifest: dict, *, role: str, path: str) -> dict:
    items = manifest["items"]
    for index, item in enumerate(items):
        if item["role"] == role and item["path"] == path:
            entries = [canonical(x) for x in items]
            if tree_hash(entries).hex() != manifest["merkleRootSha256"]:
                raise ValueError("MANIFEST_ROOT_INVALID")
            return {"schemaVersion": VERSION, "algorithm": ALGORITHM,
                    "leafIndex": index, "treeSize": len(items),
                    "item": item, "rootSha256": manifest["merkleRootSha256"],
                    "inclusionPath": inclusion_path(entries, index)}
    raise ValueError("ARTIFACT_NOT_IN_MERKLE_TREE")


def verify_item_proof(proof: dict) -> bool:
    try:
        if set(proof) != {"schemaVersion", "algorithm", "leafIndex", "treeSize",
                          "item", "rootSha256", "inclusionPath"}:
            return False
        if proof["schemaVersion"] != VERSION or proof["algorithm"] != ALGORITHM:
            return False
        _valid_item(proof["item"])
        return verify_inclusion(canonical(proof["item"]), proof["leafIndex"], proof["treeSize"],
                                proof["inclusionPath"], proof["rootSha256"])
    except (TypeError, KeyError, ValueError):
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build")
    build.add_argument("--root", type=Path, required=True)
    build.add_argument("--artifact", nargs=2, action="append", metavar=("ROLE", "RELATIVE_PATH"), required=True)
    build.add_argument("--output", type=Path, required=True)
    check = sub.add_parser("verify")
    check.add_argument("--root", type=Path, required=True)
    check.add_argument("--manifest", type=Path, required=True)
    proof = sub.add_parser("prove")
    proof.add_argument("--manifest", type=Path, required=True)
    proof.add_argument("--role", required=True)
    proof.add_argument("--path", required=True)
    proof.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "build":
        manifest = build_manifest(args.root, [tuple(x) for x in args.artifact])
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("x", encoding="utf8") as stream:
            json.dump(manifest, stream, sort_keys=True, indent=2)
            stream.write("\\n")
        print(manifest["merkleRootSha256"])
        return 0
    if args.command == "verify":
        passed = verify_manifest(args.root, json.loads(args.manifest.read_text(encoding="utf8")))
        print("MERKLE_EVIDENCE_PASS" if passed else "MERKLE_EVIDENCE_FAILED")
        return 0 if passed else 1
    result = prove_item(json.loads(args.manifest.read_text(encoding="utf8")),
                        role=args.role, path=args.path)
    with args.output.open("x", encoding="utf8") as stream:
        json.dump(result, stream, sort_keys=True, indent=2)
        stream.write("\\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
