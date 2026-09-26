#!/usr/bin/env python3
"""Re-verify liveness of the tri-state REST endpoint registry.

Reads ``data/registries/tri-state-rest-endpoints-v1.json`` and issues a live
HTTP request to each entry's ``base_url``. Fail-closed: exits non-zero if any
previously-verified endpoint is dead (non-200 or unreachable), or if any
entry violates the registry schema.

Entries marked ``unverifiable`` are reported but do not fail the run — they
were honest at registration time. They fail only if they claim a URL that
now returns 200... no: they are skipped entirely. Only ``verified`` entries
are re-checked.

Usage:
    python3 tools/validation/verify_rest_endpoints.py [--timeout SECONDS]
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
REGISTRY = REPO_ROOT / "data" / "registries" / "tri-state-rest-endpoints-v1.json"

REQUIRED_FIELDS = (
    "id", "state", "authority", "base_url", "service_type", "target_crs",
    "verified_at", "http_status", "provenance_label", "verification_status",
)


def check_url(url: str, timeout: float) -> tuple[int | None, str]:
    """Return (http_status, detail). Never raises."""
    request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "TSM-registry-check/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, "ok"
    except Exception as head_exc:  # some servers reject HEAD; retry GET
        try:
            get_request = urllib.request.Request(url, headers={"User-Agent": "TSM-registry-check/1.0"})
            with urllib.request.urlopen(get_request, timeout=timeout) as response:
                return response.status, "ok (GET fallback)"
        except Exception as exc:
            return None, f"{type(exc).__name__}: {head_exc or exc}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Re-verify tri-state REST endpoint liveness.")
    parser.add_argument("--timeout", type=float, default=20.0)
    args = parser.parse_args(argv)

    if not REGISTRY.is_file():
        print(f"error: registry not found: {REGISTRY}", file=sys.stderr)
        return 2

    try:
        entries = json.loads(REGISTRY.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"error: registry unreadable: {exc}", file=sys.stderr)
        return 2

    failures: list[str] = []
    checked = 0
    skipped = 0
    for entry in entries:
        missing = [f for f in REQUIRED_FIELDS if f not in entry]
        if missing:
            failures.append(f"{entry.get('id', '?')}: missing fields {missing}")
            continue
        if entry["verification_status"] != "verified":
            skipped += 1
            continue
        checked += 1
        url = entry.get("verify_url") or entry["base_url"]
        status, detail = check_url(url, args.timeout)
        if status != 200:
            failures.append(
                f"{entry['id']}: previously verified but now status={status} ({detail})"
            )
        else:
            print(f"ok: {entry['id']} -> 200")

    print(f"checked={checked} skipped_unverifiable={skipped} failures={len(failures)}")
    for failure in failures:
        print(f"FAIL: {failure}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
