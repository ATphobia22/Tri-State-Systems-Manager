#!/usr/bin/env python3
"""Run one explicitly selected HEC-RAS plan in an isolated project copy."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from hec_runtime_common import (
    RAS_PACKAGE_COMMIT,
    RAS_PACKAGE_URL,
    RAS_PACKAGE_VERSION,
    get_stage,
    load_approved_manifest,
    resolve_stage_paths,
    sha256_file,
    verify_pinned_distribution,
    verify_runtime_executable,
    write_stage_receipt,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True, help="Isolated project directory supplied by the TSM runner")
    parser.add_argument("--output", required=True, help="Empty stage output directory supplied by the TSM runner")
    parser.add_argument("--manifest", required=True, help="Approved HEC coupled-run manifest v2")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    manifest_path = Path(args.manifest)
    manifest = load_approved_manifest(manifest_path)
    stage = get_stage(manifest, "hec_ras")
    project, output, output_project = resolve_stage_paths(args.project, args.output, manifest_path)
    plan_number = stage.get("plan_number")
    timeout = stage.get("timeout_seconds")
    if not isinstance(plan_number, str) or not plan_number.strip() or plan_number.strip().upper() in {"UNASSIGNED", "TBD", "UNCONFIGURED"}:
        raise ValueError("hec_ras.plan_number must identify the exact HEC-RAS plan")
    if not isinstance(timeout, int) or isinstance(timeout, bool) or timeout < 1 or timeout > 86400:
        raise ValueError("hec_ras.timeout_seconds must be between 1 and 86400")
    executable = verify_runtime_executable(stage)
    verify_pinned_distribution("ras-commander", RAS_PACKAGE_VERSION, RAS_PACKAGE_COMMIT, RAS_PACKAGE_URL)

    from ras_commander import RasCmdr, init_ras_project

    started_at = datetime.now(timezone.utc).isoformat()
    ras_project = init_ras_project(
        str(project),
        ras_version=str(executable),
        load_results_summary=False,
        hide_intro=True,
        accept_tcu=False,
        load_hdf_metadata=False,
    )
    result = RasCmdr.compute_plan(
        plan_number,
        dest_folder=str(output_project),
        ras_object=ras_project,
        force_rerun=True,
        verify=True,
        max_runtime=float(timeout),
        overwrite_dest=False,
    )
    if not bool(result) or getattr(result, "completion_verified", None) is not True:
        raise RuntimeError(f"HEC-RAS plan {plan_number!r} failed or did not verify completion")

    receipt = {
        "schema_version": "1.0.0",
        "stage": "hec_ras",
        "status": "COMPUTE_SUCCEEDED_COMPLETION_VERIFIED",
        "run_id": manifest["run_id"],
        "source_commit": manifest["source_commit"],
        "product_version": stage["product_version"],
        "python_package": {"name": "ras-commander", "version": RAS_PACKAGE_VERSION, "commit": RAS_PACKAGE_COMMIT},
        "runtime_executable": str(executable),
        "runtime_executable_sha256": sha256_file(executable),
        "source_project": str(project),
        "source_project_package_sha256": stage["project_package_sha256"],
        "computed_project": str(output_project),
        "plan_number": plan_number,
        "completion_verified": True,
        "execution_details": getattr(result, "execution_details", {}),
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }
    write_stage_receipt(output, receipt)
    print(json.dumps({"ok": True, "stage": "hec_ras", "receipt": str(output / "hec-stage-receipt.json")}, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"HEC-RAS stage failed closed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
