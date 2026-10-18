#!/bin/bash
# Reassemble chunked BAFM ZIP files
# Run from: data/fabrics/government-downloads/

set -e

echo "Reassembling BAFM county ZIPs..."

for county in Gibson Posey Vanderburgh Warrick; do
    output="BAFM-${county}-County-IN.zip"
    pattern="chunks/BAFM-${county}-County-IN_part_*"
    
    if [ -f "$output" ]; then
        echo "  $output already exists, skipping"
        continue
    fi
    
    echo "  Reassembling $output..."
    cat $pattern > "$output"
    echo "  Done: $(du -h "$output" | cut -f1)"
done

echo ""
echo "Verifying SHA-256 hashes..."
echo "(Compare against MANIFEST.md)"

sha256sum BAFM-*.zip

echo ""
echo "All files reassembled."
