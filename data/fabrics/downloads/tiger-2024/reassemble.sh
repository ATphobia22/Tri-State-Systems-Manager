#!/bin/bash
# Reassemble chunked TIGER 2024 county ZIP
# Run from: data/fabrics/downloads/tiger-2024/
set -e

output="tl_2024_us_county.zip"
pattern="chunks/tl_2024_us_county_part_*"

if [ -f "$output" ]; then
    echo "$output already exists, skipping"
    exit 0
fi

echo "Reassembling $output..."
cat $pattern > "$output"
echo "Done: $(du -h "$output" | cut -f1)"
sha256sum "$output"
