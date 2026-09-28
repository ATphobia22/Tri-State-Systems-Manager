#!/usr/bin/env python3
"""Pack a Terrain-RGB XYZ tile pyramid into an MBTiles 1.3 archive.

Reads <tile-dir>/{z}/{x}/{y}.png plus tiles.json and writes
dist/terrain-tiles/terrain-3dep.mbtiles. Pure stdlib (sqlite3); the PNG bytes
are stored verbatim, so the Terrain-RGB encoding is untouched.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE metadata (name TEXT PRIMARY KEY, value TEXT);
CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB,
    PRIMARY KEY (zoom_level, tile_column, tile_row));
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tile-dir", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--source-id", default="terrain_3dep")
    args = ap.parse_args()

    manifest = json.loads((args.tile_dir / "tiles.json").read_text())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    if args.out.exists():
        args.out.unlink()

    con = sqlite3.connect(args.out)
    con.executescript(SCHEMA)
    meta = {
        "name": args.source_id,
        "format": "png",
        "minzoom": str(manifest["minzoom"]),
        "maxzoom": str(manifest["maxzoom"]),
        "bounds": ",".join(str(v) for v in manifest["bounds"]),
        "center": ",".join(str(v) for v in manifest["center"]),
        "description": manifest["description"],
        "type": "overlay",
        "version": "1.0.0",
    }
    con.executemany("INSERT INTO metadata (name, value) VALUES (?, ?)", meta.items())

    count = 0
    rows = []
    for zdir in sorted(args.tile_dir.iterdir()):
        if not zdir.is_dir() or not zdir.name.isdigit():
            continue
        z = int(zdir.name)
        for xdir in sorted(zdir.iterdir()):
            if not xdir.is_dir() or not xdir.name.isdigit():
                continue
            x = int(xdir.name)
            for png in sorted(xdir.glob("*.png")):
                y_xyz = int(png.stem)
                y_tms = (2**z - 1) - y_xyz  # MBTiles uses TMS row numbering
                rows.append((z, x, y_tms, png.read_bytes()))
                count += 1
    con.executemany(
        "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)",
        rows,
    )
    con.commit()

    # Verify: every tile row round-trips.
    got = con.execute("SELECT COUNT(*) FROM tiles").fetchone()[0]
    assert got == count, f"row count mismatch: {got} != {count}"
    con.close()
    print(f"wrote {args.out} ({count} tiles, source id '{args.source_id}')")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
