#!/usr/bin/env bash
# gama_crosscheck.sh — independent GNU Gama cross-check for TSM survey work.
#
# GNU Gama (https://www.gnu.org/software/gama/, GPLv3) is used here as an
# EXTERNAL validation oracle only: it is never vendored, linked, or
# copied into TSM. This script shells out to a separately installed
# `gama-local` binary. If Gama is not installed, the script exits with
# install instructions instead of failing silently.
#
# Usage:
#   scripts/survey/gama_crosscheck.sh network.xml
#       Run gama-local on a hand-written GAMA XML network file and print
#       the text + XML outputs.
#
#   scripts/survey/gama_crosscheck.sh --tsm-json network.json [tsm-result.json]
#       Convert a TSM network JSON (same shape as
#       backend/survey/adjustment.py::adjust_control_network inputs:
#       {"points": [{name,x,y,fixed}], "observations":
#       [{kind,from_point,to_point,value,sigma}]}) to minimal GAMA XML
#       (distance + direction observations only — angle/azimuth kinds
#       are refused, not silently converted), run gama-local, and —
#       when tsm-result.json (the TSM adjustment output) is given —
#       diff the adjusted coordinates within a tolerance.
#
#   Options: --tolerance <ft> (default 0.001), --out-dir <dir>.
#
# A non-zero exit means: Gama missing, conversion refused, Gama failed,
# or the diff exceeded tolerance. Adjusted coordinates from either tool
# are PROVISIONAL (see docs/survey/SURVEY-COMPUTATION-NOTES.md).
set -euo pipefail

TOLERANCE="0.001"
OUT_DIR=""
TSM_JSON=""

usage() {
  cat >&2 <<'EOF'
Usage:
  gama_crosscheck.sh [--tolerance <units>] [--out-dir <dir>] network.xml
  gama_crosscheck.sh --tsm-json network.json [--tolerance <units>] [--out-dir <dir>] [tsm-result.json]
EOF
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tolerance) TOLERANCE="$2"; shift 2 ;;
    --out-dir) OUT_DIR="$2"; shift 2 ;;
    --tsm-json) TSM_JSON="$2"; shift 2 ;;
    -h|--help) usage ;;
    --*) echo "unknown option: $1" >&2; usage ;;
    *) break ;;
  esac
done

if ! command -v gama-local >/dev/null 2>&1; then
  cat >&2 <<'EOF'
gama-local is not installed — GNU Gama cross-check cannot run.
Install GNU Gama 2.29+ (https://www.gnu.org/software/gama/):
  Debian/Ubuntu:  sudo apt install gama
  macOS (brew):   brew install gama
  or build from:  git://git.sv.gnu.org/gama.git
Gama is GPLv3 and stays an external tool; it is never vendored into TSM.
EOF
  exit 3
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
if [[ -n "$OUT_DIR" ]]; then
  mkdir -p "$OUT_DIR"
  WORKDIR="$(cd "$OUT_DIR" && pwd)"
fi

INPUT_XML=""
TSM_RESULT="${1:-}"

if [[ -n "$TSM_JSON" ]]; then
  INPUT_XML="$WORKDIR/network.xml"
  python3 - "$TSM_JSON" "$INPUT_XML" <<'PYEOF'
import json, sys, xml.etree.ElementTree as ET

network_path, out_path = sys.argv[1], sys.argv[2]
with open(network_path, encoding="utf-8") as fh:
    network = json.load(fh)

# Minimal GAMA XML (gama-local): points-observations with fixed points
# and distance/direction observations. Angle/azimuth observations are
# refused — their GAMA encoding (station orientation handling) is not
# something this script will guess at.
for obs in network.get("observations", []):
    if obs["kind"].lower() not in {"distance", "direction"}:
        raise SystemExit(
            f"refusing to convert observation kind {obs['kind']!r}: "
            "gama_crosscheck --tsm-json supports distance and direction only"
        )

root = ET.Element("gama-local", {"version": "2.0"})
net = ET.SubElement(root, "network", {"axes-xy": "en", "angles": "right-handed"})
ET.SubElement(net, "description").text = "TSM survey cross-check (provisional)"
po = ET.SubElement(net, "points-observations")
for point in network.get("points", []):
    attrs = {"id": str(point["name"]), "x": repr(float(point["x"])), "y": repr(float(point["y"]))}
    if point.get("fixed"):
        attrs["fix"] = "xy"
    ET.SubElement(po, "point", attrs)
for obs in network.get("observations", []):
    attrs = {
        "from": str(obs["from_point"]),
        "to": str(obs["to_point"]),
        "val": repr(float(obs["value"])),
        "stdev": repr(float(obs.get("sigma", 1.0))),
    }
    ET.SubElement(po, obs["kind"].lower(), attrs)
ET.ElementTree(root).write(out_path, encoding="utf-8", xml_declaration=True)
print(f"wrote GAMA network XML: {out_path}")
PYEOF
else
  if [[ $# -lt 1 ]]; then usage; fi
  INPUT_XML="$1"
fi

TEXT_OUT="$WORKDIR/gama-output.txt"
XML_OUT="$WORKDIR/gama-output.xml"
echo "running: gama-local $INPUT_XML --text $TEXT_OUT --xml $XML_OUT"
if ! gama-local "$INPUT_XML" --text "$TEXT_OUT" --xml "$XML_OUT"; then
  echo "gama-local failed (see above); outputs (if any) in $WORKDIR" >&2
  exit 4
fi
echo "--- gama-local text output ---"
cat "$TEXT_OUT"
echo "--- end gama-local text output ---"
echo "XML output: $XML_OUT"

if [[ -n "$TSM_JSON" && -n "$TSM_RESULT" ]]; then
  python3 - "$XML_OUT" "$TSM_RESULT" "$TOLERANCE" <<'PYEOF'
import json, math, sys, xml.etree.ElementTree as ET

xml_path, result_path, tolerance = sys.argv[1], sys.argv[2], float(sys.argv[3])
with open(result_path, encoding="utf-8") as fh:
    tsm = json.load(fh)
adjusted = tsm.get("adjusted_points", {})

# Best-effort parse of GAMA XML output: adjusted points are <point>
# elements carrying x/y. If the output schema differs, report that
# instead of inventing a comparison.
gama_points = {}
for element in ET.parse(xml_path).getroot().iter():
    if element.tag.rsplit("}", 1)[-1] == "point" and "x" in element.attrib:
        gama_points[element.attrib.get("id")] = (
            float(element.attrib["x"]), float(element.attrib["y"])
        )
if not gama_points:
    print("could not find adjusted <point x/y> entries in GAMA XML output;", file=sys.stderr)
    print("compare the printed outputs manually.", file=sys.stderr)
    raise SystemExit(5)

worst = 0.0
for name, (x, y) in adjusted.items():
    if name not in gama_points:
        print(f"GAMA output has no adjusted point {name!r}", file=sys.stderr)
        raise SystemExit(5)
    gx, gy = gama_points[name]
    worst = max(worst, math.hypot(x - gx, y - gy))
    print(f"{name}: TSM=({x:.6f}, {y:.6f}) GAMA=({gx:.6f}, {gy:.6f}) "
          f"diff={math.hypot(x - gx, y - gy):.6f}")
print(f"max coordinate difference: {worst:.6f} (tolerance {tolerance})")
if worst > tolerance:
    print("CROSS-CHECK FAILED: difference exceeds tolerance", file=sys.stderr)
    raise SystemExit(6)
print("CROSS-CHECK PASSED within tolerance (provisional — both tools agree, neither certifies)")
PYEOF
fi
