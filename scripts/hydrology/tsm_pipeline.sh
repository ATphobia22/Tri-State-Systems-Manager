#!/usr/bin/env bash
# TSM hydrology pipeline: fail-closed preflight and evidence screening.
#
# This script deliberately does NOT edit .g01 files, compile an unverified .u01,
# invoke HEC-RAS, publish GIS products, or send alerts. Those steps remain blocked
# until a version-matched HEC-RAS adapter and authoritative inputs are verified.
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
readonly LOG_DIR="${TSM_LOG_DIR:-${REPO_ROOT}/logs/hydrology}"
readonly DATA_DIR="${TSM_DATA_DIR:-${REPO_ROOT}/modelling_zone}"
readonly REPORT_DIR="${TSM_REPORT_DIR:-${REPO_ROOT}/artifacts/hydrology}"
readonly GAUGE_ID="${TSM_GAUGE_ID:-03378500}"
readonly BOUNDARY="${TSM_BOUNDARY:-WABASH_INFLOW}"
readonly SLOPE="${TSM_NORMAL_DEPTH_SLOPE_FT_FT:-0.0004}"
readonly CSV_PATH="${TSM_HYDROGRAPH_CSV:-${DATA_DIR}/boundary.csv}"
readonly TELEMETRY_EVIDENCE="${TSM_TELEMETRY_EVIDENCE_JSON:-}"
readonly RUNTIME_LOG="${TSM_HEC_RAS_LOG:-}"
readonly HDF5_PATH="${TSM_HDF5_PATH:-}"
readonly WSE_DATASET="${TSM_WSE_DATASET:-}"
readonly CELL_CENTER_DATASET="${TSM_CELL_CENTER_DATASET:-}"

mkdir -p -- "${LOG_DIR}" "${REPORT_DIR}"
readonly RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
readonly LOG_PATH="${LOG_DIR}/pipeline-${RUN_ID}.log"
readonly REPORT_PATH="${REPORT_DIR}/preflight-${RUN_ID}.json"
exec 3>&1 4>&2
exec > >(tee -a "${LOG_PATH}") 2>&1

log() { printf '[%s] [%s] %s\n' "$(date -u +%FT%TZ)" "$1" "$2"; }
die() { log ERROR "$1"; exit 1; }
on_error() {
  local code=$?
  log ERROR "Unexpected command failure (exit ${code}, line ${BASH_LINENO[0]:-unknown}); pipeline remains locked."
  exit "$code"
}
trap on_error ERR

log INFO "TSM hydrology pipeline preflight started; run_id=${RUN_ID}"
log INFO "No model execution or source mutation is enabled by this script."

command -v python3 >/dev/null 2>&1 || die "python3 is required."
[[ -f "${CSV_PATH}" ]] || die "Hydrograph CSV missing: ${CSV_PATH}"
[[ -n "${TELEMETRY_EVIDENCE}" && -f "${TELEMETRY_EVIDENCE}" ]] || die "A separate verified telemetry evidence JSON is required; a gauge ID or CSV alone is insufficient."

export PYTHONPATH="${REPO_ROOT}${PYTHONPATH:+:${PYTHONPATH}}"
export TSM_REPORT_PATH="${REPORT_PATH}"
export TSM_CSV_PATH="${CSV_PATH}"
export TSM_EVIDENCE_PATH="${TELEMETRY_EVIDENCE}"
export TSM_GAUGE_ID="${GAUGE_ID}"
export TSM_BOUNDARY="${BOUNDARY}"
export TSM_SLOPE="${SLOPE}"

python3 - <<'PY'
import json
import os
import sys
from pathlib import Path

from tsm_runtime.boundary_flow_validator import validate_boundary_csv

report_path = Path(os.environ["TSM_REPORT_PATH"])
try:
    evidence = json.loads(Path(os.environ["TSM_EVIDENCE_PATH"]).read_text(encoding="utf-8"))
    result = validate_boundary_csv(
        os.environ["TSM_CSV_PATH"],
        boundary=os.environ["TSM_BOUNDARY"],
        gauge_id=os.environ["TSM_GAUGE_ID"],
        normal_depth_slope_ft_ft=float(os.environ["TSM_SLOPE"]),
        telemetry_evidence=evidence,
    )
except Exception as exc:
    report_path.write_text(json.dumps({
        "status": "PIPELINE_LOCKED",
        "stage": "telemetry_validation",
        "errors": [f"validator exception: {type(exc).__name__}: {exc}"],
        "execution_allowed": False,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"GATE_LOCKED: telemetry validation could not complete: {exc}", file=sys.stderr)
    raise SystemExit(2)

payload = {
    "status": result.status,
    "stage": "telemetry_validation",
    "boundary": result.boundary,
    "gauge_id": result.gauge_id,
    "records_seen": result.records_seen,
    "missing_records": result.missing_records,
    "missing_fraction": result.missing_fraction,
    "max_consecutive_missing": result.max_consecutive_missing,
    "max_froude": result.max_froude,
    "errors": list(result.errors),
    "execution_allowed": False,
}
report_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(json.dumps(payload, indent=2))
if not result.valid:
    raise SystemExit(2)
PY

log INFO "Telemetry structural checks passed for review only; they do not authorize a solver run."
if [[ -n "${RUNTIME_LOG}" ]]; then
  [[ -f "${RUNTIME_LOG}" ]] || die "Configured runtime log does not exist: ${RUNTIME_LOG}"
  export TSM_RUNTIME_LOG="${RUNTIME_LOG}"
  export TSM_REPORT_PATH
  python3 - <<'PY'
import json, os, sys
from pathlib import Path
from tsm_runtime.convergence_monitor import inspect_hec_ras_log
report = inspect_hec_ras_log(os.environ["TSM_RUNTIME_LOG"])
payload = report.as_dict()
Path(os.environ["TSM_REPORT_PATH"]).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(json.dumps(payload, indent=2))
if report.status != "SCREENED_FOR_REVIEW":
    raise SystemExit(2)
PY
  log INFO "Runtime log passed screening only; this is not independent proof of model validity."
fi

if [[ -n "${HDF5_PATH}" || -n "${WSE_DATASET}" || -n "${CELL_CENTER_DATASET}" ]]; then
  [[ -n "${HDF5_PATH}" && -n "${WSE_DATASET}" && -n "${CELL_CENTER_DATASET}" ]] || die "HDF5 extraction requires HDF5 path plus explicit WSE and cell-center dataset paths."
  [[ -f "${HDF5_PATH}" ]] || die "Configured HDF5 result file does not exist: ${HDF5_PATH}"
  log INFO "HDF5 file and explicit dataset paths supplied, but export is not run by this preflight script; validate the source schema and metadata in a dedicated extraction job."
fi

cat >&3 <<EOF
TSM pipeline result: PIPELINE_LOCKED
Preflight report: ${REPORT_PATH}
Runtime log: ${LOG_PATH}
Reason: no verified HEC-RAS-version-specific adapter is enabled. No geometry mutation,
.u01 compilation, solver execution, GeoPackage publication, or stakeholder alert occurred.
EOF
log WARN "Preflight complete. Pipeline intentionally remains locked before model execution."
exit 3
