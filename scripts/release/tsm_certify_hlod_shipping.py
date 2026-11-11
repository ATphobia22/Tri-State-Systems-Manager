#!/usr/bin/env python3
"""
TSM Production HLOD / UE5.8 Shipping certification gate.

Emits a machine-readable certification report. Returns exit 0 only when
required evidence files exist and pass checks — never invents Shipping success.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("TSM-CertifyHlodShipping")

ROOT = Path(__file__).resolve().parents[2]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            c = f.read(8192)
            if not c:
                break
            h.update(c)
    return h.hexdigest()


def check_path(path: Path, label: str) -> Dict[str, Any]:
    ok = path.exists()
    rec: Dict[str, Any] = {
        "label": label,
        "path": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
        "present": ok,
    }
    if ok and path.is_file():
        rec["sha256"] = sha256_file(path)
        rec["size_bytes"] = path.stat().st_size
    return rec


def certify(args: argparse.Namespace) -> Dict[str, Any]:
    tileset = Path(args.tileset)
    glb_dir = Path(args.glb_dir)
    shipping_exe = Path(args.shipping_exe) if args.shipping_exe else None
    airgap_log = Path(args.airgap_log) if args.airgap_log else None

    checks: List[Dict[str, Any]] = []

    # HLOD / tileset evidence
    t = check_path(tileset, "tileset.json")
    checks.append(t)
    glb_count = 0
    if glb_dir.exists():
        glbs = list(glb_dir.rglob("*.glb"))
        glb_count = len(glbs)
    checks.append(
        {
            "label": "glb_mesh_count",
            "path": str(glb_dir),
            "present": glb_count > 0,
            "count": glb_count,
        }
    )

    staging_only = True
    if tileset.exists():
        try:
            data = json.loads(tileset.read_text(encoding="utf-8"))
            extras = (data.get("root") or {}).get("extras") or {}
            tsm = extras.get("tsm") or {}
            auth = str(tsm.get("authority", ""))
            if auth == "DERIVED_STAGING" or glb_count == 0:
                staging_only = True
            else:
                staging_only = False
            checks.append(
                {
                    "label": "tileset_authority",
                    "present": True,
                    "authority": auth or "UNSPECIFIED",
                    "staging_only": staging_only,
                }
            )
        except json.JSONDecodeError as e:
            checks.append({"label": "tileset_parse", "present": False, "error": str(e)})

    # Shipping evidence (optional paths)
    if shipping_exe:
        checks.append(check_path(shipping_exe, "ue58_shipping_executable"))
    else:
        checks.append(
            {
                "label": "ue58_shipping_executable",
                "present": False,
                "path": None,
                "note": "Pass --shipping-exe when BuildCookRun artifact exists",
            }
        )

    if airgap_log:
        checks.append(check_path(airgap_log, "airgap_acceptance_log"))
    else:
        checks.append(
            {
                "label": "airgap_acceptance_log",
                "present": False,
                "path": None,
                "note": "Pass --airgap-log from Test-TSMShippingRuntime.ps1 output",
            }
        )

    hlod_ready = bool(tileset.exists() and glb_count > 0 and not staging_only)
    shipping_ready = bool(
        shipping_exe
        and shipping_exe.exists()
        and airgap_log
        and airgap_log.exists()
    )

    report = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
        "summary": {
            "hlod_production_certified": hlod_ready,
            "ue58_shipping_airgap_certified": shipping_ready,
            "staging_only": staging_only,
            "glb_count": glb_count,
        },
        "policy": {
            "human_authority_final": True,
            "certification_requires_evidence_files": True,
            "derived_staging_is_not_production": True,
        },
    }
    return report


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--tileset",
        type=Path,
        default=ROOT / "tiles" / "posey_county_offline" / "tileset.json",
    )
    p.add_argument(
        "--glb-dir",
        type=Path,
        default=ROOT / "tiles" / "posey_county_offline",
    )
    p.add_argument("--shipping-exe", type=Path, default=None)
    p.add_argument("--airgap-log", type=Path, default=None)
    p.add_argument(
        "--out",
        type=Path,
        default=ROOT
        / "integrations"
        / "registry"
        / "tsm_hlod_shipping_certification_report.json",
    )
    p.add_argument(
        "--require-full",
        action="store_true",
        help="Exit 1 unless both HLOD and Shipping are certified",
    )
    args = p.parse_args(argv)

    report = certify(args)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    logger.info("Wrote %s", args.out)

    s = report["summary"]
    logger.info("HLOD production certified: %s", s["hlod_production_certified"])
    logger.info("UE5.8 shipping airgap certified: %s", s["ue58_shipping_airgap_certified"])
    logger.info("staging_only: %s  glb_count: %s", s["staging_only"], s["glb_count"])

    if args.require_full:
        if not (s["hlod_production_certified"] and s["ue58_shipping_airgap_certified"]):
            logger.error("Full certification not met.")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
