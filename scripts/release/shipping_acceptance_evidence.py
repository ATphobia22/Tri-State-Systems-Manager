"""Evidence-based gate for a reviewed clean-host UE5.8 Shipping launch.

An executable and an arbitrary text log are NOT proof of an offline launch.
The automated smoke receipt starts in an interaction-pending state. An
independent reviewer must attach real artifact hashes and explicitly accept
all checks; this helper validates those bytes, not the truth of an image.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

_FLAGS = (
    "firewallIsolationApplied",
    "processStarted",
    "processAliveAtObservation",
    "runtimeMenusVerified",
    "terrainStreamingVerified",
    "screenshotsVerified",
    "engineeringDataVerified",
    "cleanHostVerified",
    "networkOfflineVerified",
    "noLocalhostNoWebviewVerified",
)
_ARTIFACTS = ("buildCookRunLog", "runtimeLog", "headedScreenshot", "stagedDataManifest")
_SHA256 = re.compile(r"^[a-f0-9]{64}$", re.I)
_SOURCE_SHA = re.compile(r"^[a-f0-9]{40}$", re.I)


def _digest(file: Path) -> str:
    h = hashlib.sha256()
    with file.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _is_amd64_pe(file: Path) -> bool:
    if not file.is_file() or file.stat().st_size < 4096:
        return False
    with file.open("rb") as handle:
        header = handle.read(4096)
    if header[:2] != b"MZ":
        return False
    offset = int.from_bytes(header[0x3c:0x40], "little")
    return (64 <= offset <= len(header) - 26
            and header[offset:offset + 4] == b"PE\\x00\\x00"
            and int.from_bytes(header[offset + 4:offset + 6], "little") == 0x8664
            and int.from_bytes(header[offset + 24:offset + 26], "little") == 0x20b)


def assess_shipping_acceptance(shipping_exe: Path | None, receipt_path: Path | None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "certified": False,
        "shipping_exe_present": bool(shipping_exe and shipping_exe.is_file()),
        "airgap_log_present": bool(receipt_path and receipt_path.is_file()),
        "reason": "Shipping executable and reviewed acceptance receipt are both required",
    }
    if not result["shipping_exe_present"] or not result["airgap_log_present"]:
        return result
    assert shipping_exe is not None and receipt_path is not None
    if not _is_amd64_pe(shipping_exe):
        result["reason"] = "Shipping binary is not a nonempty PE32+ AMD64 executable"
        return result
    try:
        if receipt_path.stat().st_size > 256 * 1024:
            raise ValueError("Acceptance receipt exceeds size limit")
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        if not isinstance(receipt, dict):
            raise ValueError("Acceptance receipt must be a JSON object")
        if receipt.get("schema") != "tsm.ue58.windows11.offline-smoke.v1":
            raise ValueError("Expected a reviewed Windows11 offline-smoke JSON receipt, not a text log")
        if receipt.get("classification") != "INDEPENDENTLY_ACCEPTED" or receipt.get("humanReviewRequired") is not False:
            raise ValueError("Smoke/process startup alone is not independently accepted")
        review = receipt.get("independentReview")
        if not isinstance(review, dict) or not str(review.get("reviewer", "")).strip() or not str(review.get("reviewedAtUtc", "")).strip():
            raise ValueError("Independent reviewer and UTC review date are required")
        if receipt.get("engineVersion") != "5.8":
            raise ValueError("Exact UE5.8 version evidence is required")
        source = receipt.get("sourceCommit")
        if not isinstance(source, str) or not _SOURCE_SHA.fullmatch(source):
            raise ValueError("Immutable source commit is required")
        if receipt.get("executableSha256", "").lower() != _digest(shipping_exe):
            raise ValueError("Installed Shipping PE SHA-256 differs from reviewed receipt")
        missing = [name for name in _FLAGS if receipt.get(name) is not True]
        if missing:
            raise ValueError("Acceptance not verified: " + ", ".join(missing))
        artifacts = receipt.get("evidenceArtifacts")
        if not isinstance(artifacts, dict):
            raise ValueError("Missing hashed release evidence artifacts")
        root = receipt_path.resolve().parent
        accepted: dict[str, Path] = {}
        for name in _ARTIFACTS:
            entry = artifacts.get(name)
            if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
                raise ValueError(f"Missing {name} artifact path")
            digest = entry.get("sha256")
            if not isinstance(digest, str) or not _SHA256.fullmatch(digest):
                raise ValueError(f"Invalid {name} SHA-256")
            file = (root / entry["path"]).resolve()
            if not file.is_relative_to(root) or not file.is_file() or file.stat().st_size == 0:
                raise ValueError(f"Missing or unsafe {name} artifact")
            if _digest(file) != digest.lower():
                raise ValueError(f"Hash mismatch for {name}")
            accepted[name] = file
        screenshot = accepted["headedScreenshot"].read_bytes()[:24]
        if screenshot[:8] != b"\\x89PNG\\r\\n\\x1a\\n" or len(screenshot) < 24:
            raise ValueError("Headed evidence is not a PNG screenshot")
        width = int.from_bytes(screenshot[16:20], "big")
        height = int.from_bytes(screenshot[20:24], "big")
        if width < 640 or height < 360:
            raise ValueError("Headed screenshot dimensions too small")
        build_log = accepted["buildCookRunLog"].read_text(encoding="utf-8", errors="replace")
        if (f"TSM_SOURCE_COMMIT={source}" not in build_log
                or not re.search(r"AutomationTool exiting with ExitCode=0\\b", build_log)
                or not re.search(r"clientconfig[=:\\s]+Shipping", build_log, re.I)):
            raise ValueError("BuildCookRun log does not bind source, Shipping, and UAT exit 0")
        manifest = json.loads(accepted["stagedDataManifest"].read_text(encoding="utf-8"))
        if manifest.get("schemaVersion") != 1 or manifest.get("integrity") != "sha256" or not manifest.get("files"):
            raise ValueError("Staged native data integrity manifest is not valid")
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as error:
        result["reason"] = str(error)
        return result
    result["certified"] = True
    result["reason"] = ("Reviewed acceptance receipt and referenced evidence bytes verified; "
                        "human authority remains final and the reviewer identity is not cryptographically authenticated")
    return result
