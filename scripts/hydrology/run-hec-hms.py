#!/usr/bin/env python3
"""Run one explicitly selected HEC-HMS simulation in an isolated project copy."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from hec_runtime_common import (
    HMS_PACKAGE_COMMIT,
    HMS_PACKAGE_URL,
    HMS_PACKAGE_VERSION,
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
    stage = get_stage(manifest, "hec_hms")
    project, output, output_project = resolve_stage_paths(args.project, args.output, manifest_path)
    run_name = stage.get("run_name")
    timeout = stage.get("timeout_seconds")
    if not isinstance(run_name, str) or not run_name.strip() or run_name.strip().upper() in {"UNASSIGNED", "TBD", "UNCONFIGURED"}:
        raise ValueError("hec_hms.run_name must identify the exact named HEC-HMS run")
    if not isinstance(timeout, int) or isinstance(timeout, bool) or timeout < 1 or timeout > 86400:
        raise ValueError("hec_hms.timeout_seconds must be between 1 and 86400")
    executable = verify_runtime_executable(stage)
    verify_pinned_distribution("hms-commander", HMS_PACKAGE_VERSION, HMS_PACKAGE_COMMIT, HMS_PACKAGE_URL)

    from hms_commander import HmsCmdr, init_hms_project

    started_at = datetime.now(timezone.utc).isoformat()
    hms_project = init_hms_project(
        str(project),
        hms_exe_path=str(executable),
        load_dss_metadata=False,
    )
    success = HmsCmdr.compute_run(
        run_name,
        hms_object=hms_project,
        dest_folder=output_project,
        overwrite_dest=False,
        timeout=timeout,
        save_project=True,
    )
    if success is not True:
        raise RuntimeError(f"HEC-HMS compute_run failed for configured run {run_name!r}")

    receipt = {
        "schema_version": "1.0.0",
        "stage": "hec_hms",
        "status": "COMPUTE_SUCCEEDED",
        "run_id": manifest["run_id"],
        "source_commit": manifest["source_commit"],
        "product_version": stage["product_version"],
        "python_package": {"name": "hms-commander", "version": HMS_PACKAGE_VERSION, "commit": HMS_PACKAGE_COMMIT},
        "runtime_executable": str(executable),
        "runtime_executable_sha256": sha256_file(executable),
        "source_project": str(project),
        "source_project_package_sha256": stage["project_package_sha256"],
        "computed_project": str(output_project),
        "run_name": run_name,
        "started_at": started_at,
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }
    write_stage_receipt(output, receipt)
    print(json.dumps({"ok": True, "stage": "hec_hms", "receipt": str(output / "hec-stage-receipt.json")}, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"HEC-HMS stage failed closed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
