#!/bin/bash
# Reassemble the USGS 3DEP 1m DEM from chunks
# The original 246 MB file exceeds GitHub's 100MB limit, so it's stored as 50MB chunks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="$SCRIPT_DIR/USGS_1M_16_x41y419_IN.tif"

if [ -f "$OUTPUT" ]; then
  echo "File already exists: $OUTPUT"
  exit 0
fi

echo "Reassembling USGS 3DEP 1m DEM from 5 chunks..."
cat "$SCRIPT_DIR"/USGS_1M_16_x41y419_IN.tif.part-* > "$OUTPUT"

echo "Verifying..."
EXPECTED_SIZE=257825774
ACTUAL_SIZE=$(stat -c%s "$OUTPUT")
if [ "$ACTUAL_SIZE" -eq "$EXPECTED_SIZE" ]; then
  echo "OK: $OUTPUT ($ACTUAL_SIZE bytes)"
else
  echo "WARNING: size mismatch (expected $EXPECTED_SIZE, got $ACTUAL_SIZE)"
fi
