#!/usr/bin/env python3
"""Publish and independently verify a downloadable SHA-256 Cesium release receipt.

Build receipt describes the exact static dist bytes; a later *separate*
published-URL check fetches representative remote assets and compares them with
the build-job-pinned receipt digest. Hashes are not digital signatures, proof
of source authenticity, engineering acceptance, or a complete remote mirror.
Python stdlib only, network only for explicit verify-published.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen

SCHEMA = "tsm.cesium.published-release-receipt.v1"
RECEIPT = "cesium-release-receipt.json"
SIDECAR = RECEIPT + ".sha256"
EXCLUDED = frozenset((RECEIPT, SIDECAR))
SHA = re.compile(r"[0-9a-f]{64}\Z")
COMMIT = re.compile(r"[0-9a-f]{40}\Z")
MAX_RECEIPT_BYTES = 16 * 1024 * 1024
MAX_FETCH_BYTES = 32 * 1024 * 1024
MAX_FILES = 250000
REQUIRED = (
    "index.html",
    "cesium/index.html",
    "data/cesium-regional/terrain/layer.json",
    "data/cesium-regional/terrain/sources.json",
    "data/cesium-regional/replay.json",
    "data/cesium-regional/screening.json",
    "data/cesium-regional/posey-buildings/tileset.json",
    "mount-vernon-scene/scene.receipt.json",
    "3d-tiles/tileset.json",
    "vendor/cesium/Workers/createVerticesFromHeightmap.js",
)
SAMPLES = (
    "cesium/index.html",
    "data/cesium-regional/terrain/layer.json",
    "data/cesium-regional/replay.json",
    "data/cesium-regional/screening.json",
    "data/cesium-regional/posey-buildings/tileset.json",
    "3d-tiles/tileset.json",
    "vendor/cesium/Workers/createVerticesFromHeightmap.js",
)


def digest_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def digest_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1048576), b""):
            h.update(chunk)
    return h.hexdigest()


def safe_name(name: str) -> str:
    if (not isinstance(name, str) or not name or "\\" in name or
            any(ch in name for ch in ("?", "#", "\0", "%")) or
            PurePosixPath(name).is_absolute() or name.startswith("./") or
            any(part in ("", ".", "..") for part in name.split("/"))):
        raise ValueError(f"Unsafe release path: {name!r}")
    return name


def site_base(raw: str) -> str:
    parsed = urlsplit(raw)
    if (parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password
            or parsed.query or parsed.fragment or not parsed.path.endswith("/")
            or any(x in parsed.path for x in ("..", "\\", "%"))):
        raise ValueError("Release base must be a clean HTTPS directory URL ending in /")
    return raw


def require_regular(root: Path, path: Path) -> None:
    if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError(f"Unsafe or missing release file: {path}")


def inventory(root: Path) -> list[dict]:
    root = root.resolve()
    if not root.is_dir():
        raise ValueError("Missing release directory")
    files = []
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError(f"Symlinks prohibited in release: {path}")
        if not path.is_file():
            continue
        rel = safe_name(path.relative_to(root).as_posix())
        if rel in EXCLUDED:
            continue
        size = path.stat().st_size
        files.append({"path": rel, "bytes": size, "sha256": digest_file(path)})
        if len(files) > MAX_FILES:
            raise ValueError("Release file count exceeds guard")
    files.sort(key=lambda entry: entry["path"])
    if not files:
        raise ValueError("No release assets")
    actual = {f["path"]: f for f in files}
    for required in REQUIRED:
        if required not in actual or actual[required]["bytes"] == 0:
            raise ValueError(f"Required Cesium release asset missing/empty: {required}")
    return files


def ensure_receipt(receipt: dict) -> dict[str, dict]:
    if receipt.get("schema") != SCHEMA or receipt.get("classification") != "RELEASE_BYTE_INTEGRITY_ONLY":
        raise ValueError("Not a TSM Cesium byte-integrity receipt")
    if not COMMIT.fullmatch(receipt.get("gitSha", "")):
        raise ValueError("Receipt missing full Git SHA")
    site_base(receipt.get("siteBase", ""))
    entries = receipt.get("files")
    if not isinstance(entries, list) or not entries or len(entries) > MAX_FILES:
        raise ValueError("Invalid receipt file inventory")
    keys = []
    for item in entries:
        key = safe_name(item["path"])
        if key in EXCLUDED or not SHA.fullmatch(item.get("sha256", "")):
            raise ValueError("Receipt contains invalid digest/name")
        if type(item.get("bytes")) is not int or item["bytes"] < 0:
            raise ValueError("Invalid receipt file size")
        keys.append(key)
    if keys != sorted(set(keys)) or len(keys) != receipt.get("fileCount"):
        raise ValueError("Receipt file list must be sorted, unique and complete")
    for required in REQUIRED:
        matches = [entry for entry in entries if entry["path"] == required]
        if len(matches) != 1 or matches[0]["bytes"] == 0:
            raise ValueError(f"Required file not proven by receipt: {required}")
    return {entry["path"]: entry for entry in entries}


def create(dist: Path, base: str, git_sha: str, run_id: str) -> dict:
    site_base(base)
    if not COMMIT.fullmatch(git_sha):
        raise ValueError("A full immutable Git SHA is required")
    if not run_id.isdecimal() or not run_id.strip("0"):
        raise ValueError("A positive GitHub workflow run ID is required")
    if dist.is_symlink():
        raise ValueError("Cannot package symlink release root")
    for name in EXCLUDED:
        if (dist / name).exists():
            raise ValueError(f"Refusing to overwrite existing release receipt: {name}")
    files = inventory(dist)
    receipt = {
        "schema": SCHEMA,
        "classification": "RELEASE_BYTE_INTEGRITY_ONLY",
        "gitSha": git_sha,
        "githubRunId": run_id,
        "siteBase": base,
        "generatedAtUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "fileCount": len(files),
        "totalAssetBytes": sum(item["bytes"] for item in files),
        "publicationVerification": "NOT_PERFORMED_BY_BUILD",
        "surveyAccuracyVerified": False,
        "regulatoryAcceptance": False,
        "files": files,
    }
    ensure_receipt(receipt)
    body = (json.dumps(receipt, sort_keys=True, indent=2, allow_nan=False) + "\n").encode("utf-8")
    if len(body) > MAX_RECEIPT_BYTES:
        raise ValueError("Receipt exceeds 16 MiB bound")
    digest = digest_bytes(body)
    (dist / RECEIPT).write_bytes(body)
    (dist / SIDECAR).write_text(f"{digest}  {RECEIPT}\n", encoding="ascii")
    return {"status": "BUILD_RECEIPT_CREATED", "fileCount": len(files),
            "sha256": digest, "receipt": str(dist / RECEIPT)}


def read_receipt(raw: bytes, expected: str | None = None) -> dict:
    if len(raw) > MAX_RECEIPT_BYTES:
        raise ValueError("Receipt exceeds bound")
    if expected is not None and (not SHA.fullmatch(expected) or digest_bytes(raw) != expected):
        raise ValueError("Release receipt SHA-256 mismatch")
    receipt = json.loads(raw)
    ensure_receipt(receipt)
    return receipt


def verify_local(dist: Path, expected_sha: str) -> dict:
    if dist.is_symlink():
        raise ValueError("Cannot verify symlink release root")
    raw = (dist / RECEIPT).read_bytes()
    sidecar = (dist / SIDECAR).read_text(encoding="ascii")
    actual = digest_bytes(raw)
    if sidecar != f"{actual}  {RECEIPT}\n":
        raise ValueError("Receipt sidecar digest mismatch")
    receipt = read_receipt(raw, actual)
    if receipt["gitSha"] != expected_sha:
        raise ValueError("Release commit mismatch")
    entries = inventory(dist)
    if entries != receipt["files"] or sum(e["bytes"] for e in entries) != receipt["totalAssetBytes"]:
        raise ValueError("Local published inventory changed after receipt creation")
    return {"status": "LOCAL_BYTES_MATCH", "sha256": actual, "fileCount": len(entries)}


def fetch(base: str, path: str, limit: int) -> bytes:
    url = base + quote(safe_name(path), safe="/")
    request = Request(url, headers={"User-Agent": "TSM-Cesium-Receipt-Verify/1.0"})
    with urlopen(request, timeout=50) as stream:
        if stream.geturl() != url or stream.status != 200:
            raise ValueError(f"Unexpected redirect or response for {path}")
        data = stream.read(limit + 1)
    if len(data) > limit:
        raise ValueError(f"Remote release asset too large for bounded check: {path}")
    return data


def verify_published(base: str, expected_receipt_sha: str, expected_git_sha: str,
                     samples: tuple[str, ...] = SAMPLES, fetcher=fetch) -> dict:
    base = site_base(base)
    if not SHA.fullmatch(expected_receipt_sha) or not COMMIT.fullmatch(expected_git_sha):
        raise ValueError("Published verification requires independent pinned digests and Git SHA")
    raw = fetcher(base, RECEIPT, MAX_RECEIPT_BYTES)
    receipt = read_receipt(raw, expected_receipt_sha)
    if receipt["siteBase"] != base or receipt["gitSha"] != expected_git_sha:
        raise ValueError("Published receipt does not match target release")
    sidecar = fetcher(base, SIDECAR, 256).decode("ascii")
    if sidecar != f"{expected_receipt_sha}  {RECEIPT}\n":
        raise ValueError("Published receipt sidecar does not match build hash")
    lookup = ensure_receipt(receipt)
    checked = []
    for path in samples:
        path = safe_name(path)
        if path not in lookup:
            raise ValueError(f"Sample not present in release receipt: {path}")
        data = fetcher(base, path, MAX_FETCH_BYTES)
        entry = lookup[path]
        if len(data) != entry["bytes"] or digest_bytes(data) != entry["sha256"]:
            raise ValueError(f"Published file differs from build artifact: {path}")
        checked.append({"path": path, "bytes": len(data), "sha256": digest_bytes(data)})
    if not checked:
        raise ValueError("At least one published file must be downloaded and checked")
    return {
        "status": "REMOTE_SAMPLES_MATCH_BUILD",
        "receiptSha256": expected_receipt_sha,
        "gitSha": expected_git_sha,
        "sampledFileCount": len(checked),
        "manifestedFileCount": receipt["fileCount"],
        "samplingLimitation": "NOT_ALL_PUBLISHED_FILES_DOWNLOADED",
        "surveyAccuracyVerified": False,
        "regulatoryAcceptance": False,
        "checked": checked,
    }


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="mode", required=True)
    c = sub.add_parser("create")
    c.add_argument("--dist", type=Path, required=True)
    c.add_argument("--base-url", required=True)
    c.add_argument("--git-sha", required=True)
    c.add_argument("--run-id", required=True)
    l = sub.add_parser("verify-local")
    l.add_argument("--dist", type=Path, required=True)
    l.add_argument("--expected-git-sha", required=True)
    q = sub.add_parser("verify-published")
    q.add_argument("--base-url", required=True)
    q.add_argument("--expected-receipt-sha", required=True)
    q.add_argument("--expected-git-sha", required=True)
    q.add_argument("--sample", action="append", default=None)
    q.add_argument("--output", type=Path, required=True)
    args = p.parse_args(argv)
    try:
        if args.mode == "create":
            result = create(args.dist, args.base_url, args.git_sha, args.run_id)
        elif args.mode == "verify-local":
            result = verify_local(args.dist, args.expected_git_sha)
        else:
            result = verify_published(args.base_url, args.expected_receipt_sha,
                                      args.expected_git_sha,
                                      tuple(args.sample) if args.sample else SAMPLES)
            with args.output.open("x", encoding="utf-8") as output:
                json.dump(result, output, indent=2, sort_keys=True, allow_nan=False)
                output.write("\n")
    except (OSError, ValueError, KeyError, TypeError, UnicodeError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "FAILED", "error": str(exc)}), file=sys.stderr)
        return 1
    print(json.dumps({k: v for k, v in result.items() if k != "checked"}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
