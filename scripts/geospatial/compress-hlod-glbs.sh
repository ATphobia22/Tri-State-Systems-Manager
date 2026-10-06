#!/usr/bin/env bash
set -euo pipefail
INPUT_DIR=${1:?input directory}; OUTPUT_DIR=${2:?output directory}; BIN=${GLTF_TRANSFORM_BIN:-gltf-transform}
mkdir -p "$OUTPUT_DIR"
while IFS= read -r -d '' src; do
 rel=${src#"$INPUT_DIR/"}; dst="$OUTPUT_DIR/$rel"; mkdir -p "$(dirname "$dst")"
 "$BIN" draco "$src" "$dst" --method edgebreaker --encode-speed 5 --decode-speed 5 --quantize-position 14 --quantize-normal 10
 test -s "$dst"
done < <(find "$INPUT_DIR" -type f -name '*.glb' -print0 | sort -z)
cp "$INPUT_DIR/tileset.json" "$OUTPUT_DIR/tileset.json"; cp "$INPUT_DIR/manifest.json" "$OUTPUT_DIR/manifest.json"
