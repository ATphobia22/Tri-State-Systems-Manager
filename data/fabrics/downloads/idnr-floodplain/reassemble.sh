#!/bin/bash
# Reassemble chunked IDNR Posey floodplain ZIP
# Run from: data/fabrics/downloads/idnr-floodplain/
set -e

output="Posey-floodplain.zip"
pattern="chunks/Posey-floodplain_part_*"

if [ -f "$output" ]; then
    echo "$output already exists, skipping"
    exit 0
fi

echo "Reassembling $output..."
cat $pattern > "$output"
echo "Done: $(du -h "$output" | cut -f1)"
sha256sum "$output"
