#!/usr/bin/env python3
"""Regenerate scripts/geospatial/lengyel_*.json from EricLengyel/Transvoxel (MIT).

  python3 scripts/geospatial/regenerate_lengyel_tables.py
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

URL = "https://raw.githubusercontent.com/EricLengyel/Transvoxel/main/Transvoxel.cpp"
OUT = Path(__file__).resolve().parent


def main() -> int:
    text = urllib.request.urlopen(URL, timeout=60).read().decode("utf-8", "replace")
    m = re.search(r"const TransitionCellData transitionCellData\[56\]\s*=\s*\{([\s\S]*?)\n\};", text)
    if not m:
        raise SystemExit("transitionCellData not found")
    entries = []
    for em in re.finditer(r"\{\s*(0x[0-9A-Fa-f]+)\s*,\s*\{([^}]*)\}\s*\}", m.group(1)):
        counts = int(em.group(1), 16)
        idxs = [int(x.strip()) for x in em.group(2).split(",") if x.strip()]
        entries.append({"geometryCounts": counts, "vertexIndex": idxs})
    if len(entries) != 56:
        raise SystemExit(f"expected 56 cell classes, got {len(entries)}")

    start = text.index("const unsigned short transitionVertexData[512][12]")
    start = text.index("{", start)
    chunk = text[start:]
    rows = []
    i = 1
    depth = 0
    buf = []
    while i < len(chunk) and len(rows) < 512:
        c = chunk[i]
        if c == "{":
            depth += 1
            if depth == 1:
                buf = []
                i += 1
                continue
        if c == "}":
            if depth == 1:
                inner = "".join(buf).strip()
                vals = [] if not inner else [int(x.strip(), 0) for x in inner.split(",") if x.strip()]
                rows.append(vals + [0xFFFF] * (12 - len(vals)))
                depth = 0
                i += 1
                while i < len(chunk) and chunk[i] in " \t\r\n,":
                    i += 1
                continue
            depth -= 1
        if depth >= 1:
            buf.append(c)
        i += 1
    if len(rows) != 512:
        raise SystemExit(f"expected 512 vertex rows, got {len(rows)}")

    (OUT / "lengyel_cell_data.json").write_text(
        json.dumps({"transitionCellData": entries}, separators=(",", ":")), encoding="utf-8"
    )
    for n in range(4):
        part = rows[n * 128 : (n + 1) * 128]
        (OUT / f"lengyel_vertex_{n}.json").write_text(json.dumps(part, separators=(",", ":")), encoding="utf-8")
    (OUT / "lengyel_transition_data.json").write_text(
        json.dumps({"transitionCellData": entries, "transitionVertexData": rows}, separators=(",", ":")),
        encoding="utf-8",
    )
    print("regenerated cell=56 vertex=512 into", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
