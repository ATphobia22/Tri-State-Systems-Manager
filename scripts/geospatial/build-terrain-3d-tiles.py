#!/usr/bin/env python3
"""Convert deterministic Terrain-RGB MBTiles to OGC 3D Tiles 1.1.

The GLBs use a tile-local ENU frame. Horizontal placement is WGS84 ellipsoidal
surface geometry; NAVD88 elevation is retained as the visualization vertical
offset without a NAVD88-to-ellipsoid transformation. This is visualization
data, not survey-grade engineering terrain.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sqlite3
import struct
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

WGS84_A = 6378137.0
WGS84_E2 = 6.6943799901413165e-3


@dataclass(frozen=True)
class TileKey:
    z: int
    x: int
    y: int


def xyz_bounds(key: TileKey) -> tuple[float, float, float, float]:
    n = 2.0 ** key.z
    west = key.x / n * 360.0 - 180.0
    east = (key.x + 1) / n * 360.0 - 180.0
    north = math.degrees(math.atan(math.sinh(math.pi * (1.0 - 2.0 * key.y / n))))
    south = math.degrees(math.atan(math.sinh(math.pi * (1.0 - 2.0 * (key.y + 1) / n))))
    return west, south, east, north


def surface(lon_deg: float, lat_deg: float) -> tuple[float, float, float]:
    lon, lat = math.radians(lon_deg), math.radians(lat_deg)
    s, c = math.sin(lat), math.cos(lat)
    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * s * s)
    return n * c * math.cos(lon), n * c * math.sin(lon), n * (1.0 - WGS84_E2) * s


def enu_basis(lon_deg: float, lat_deg: float) -> tuple[tuple[float, float, float], ...]:
    lon, lat = math.radians(lon_deg), math.radians(lat_deg)
    return (
        (-math.sin(lon), math.cos(lon), 0.0),
        (-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat)),
        (math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)),
    )


def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def sub(a, b): return a[0] - b[0], a[1] - b[1], a[2] - b[2]


def norm(v):
    d = math.sqrt(dot(v, v))
    return (0.0, 0.0, 1.0) if d == 0.0 else (v[0] / d, v[1] / d, v[2] / d)


class RGBImage:
    def __init__(self, width: int, height: int, pixels: bytes) -> None:
        self.width, self.height, self.pixels = width, height, pixels

    def rgb(self, x: int, y: int) -> tuple[int, int, int]:
        i = (y * self.width + x) * 3
        return self.pixels[i], self.pixels[i + 1], self.pixels[i + 2]


def read_png_rgb(data: bytes) -> RGBImage:
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("tile is not PNG")
    pos, width, height, idat = 8, None, None, bytearray()
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind, payload = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, depth, color, comp, filt, interlace = struct.unpack(">IIBBBBB", payload)
            if (depth, color, comp, filt, interlace) != (8, 2, 0, 0, 0):
                raise ValueError("only non-interlaced 8-bit RGB PNGs are supported")
        elif kind == b"IDAT":
            idat.extend(payload)
        elif kind == b"IEND":
            break
    if width is None or height is None:
        raise ValueError("PNG missing IHDR")
    raw, stride = zlib.decompress(bytes(idat)), width * 3
    if len(raw) != height * (stride + 1):
        raise ValueError("PNG scanline length mismatch")
    out = bytearray(height * stride)
    src = 0
    for y in range(height):
        ft, row = raw[src], bytearray(raw[src + 1:src + 1 + stride])
        src += stride + 1
        prev = out[(y - 1) * stride:y * stride] if y else b""
        for i in range(stride):
            left = row[i - 3] if i >= 3 else 0
            up = prev[i] if prev else 0
            ul = prev[i - 3] if prev and i >= 3 else 0
            if ft == 0: value = row[i]
            elif ft == 1: value = (row[i] + left) & 255
            elif ft == 2: value = (row[i] + up) & 255
            elif ft == 3: value = (row[i] + (left + up) // 2) & 255
            elif ft == 4:
                p = left + up - ul
                pa, pb, pc = abs(p - left), abs(p - up), abs(p - ul)
                pr = left if pa <= pb and pa <= pc else (up if pb <= pc else ul)
                value = (row[i] + pr) & 255
            else: raise ValueError(f"unsupported PNG filter {ft}")
            row[i] = value
        out[y * stride:(y + 1) * stride] = row
    return RGBImage(width, height, bytes(out))


def elevation(image: RGBImage, u: float, v: float) -> float:
    u, v = max(0.0, min(image.width - 1.0, u)), max(0.0, min(image.height - 1.0, v))
    x0, y0 = int(u), int(v)
    x1, y1 = min(x0 + 1, image.width - 1), min(y0 + 1, image.height - 1)
    wx, wy = u - x0, v - y0

    def e(x, y):
        r, g, b = image.rgb(x, y)
        return ((r << 16) | (g << 8) | b) / 10.0 - 10000.0

    return e(x0, y0) * (1 - wx) * (1 - wy) + e(x1, y0) * wx * (1 - wy) + e(x0, y1) * (1 - wx) * wy + e(x1, y1) * wx * wy


def make_grid(image: RGBImage, key: TileKey, size: int):
    west, south, east, north = xyz_bounds(key)
    lon0, lat0 = (west + east) / 2.0, (south + north) / 2.0
    origin, axes = surface(lon0, lat0), enu_basis(lon0, lat0)
    vertices, heights = [], []
    for row in range(size):
        fy, lat = row / (size - 1), north + (south - north) * row / (size - 1)
        for col in range(size):
            fx, lon = col / (size - 1), west + (east - west) * col / (size - 1)
            delta = sub(surface(lon, lat), origin)
            vertices.append((dot(delta, axes[0]), dot(delta, axes[1]), elevation(image, fx * 255.0, fy * 255.0)))
            heights.append(vertices[-1][2])
    return vertices, heights, axes, origin


def normals(vertices, size):
    result = []
    for row in range(size):
        for col in range(size):
            l, r = vertices[row * size + max(0, col - 1)], vertices[row * size + min(size - 1, col + 1)]
            n, s = vertices[max(0, row - 1) * size + col], vertices[min(size - 1, row + 1) * size + col]
            a, b = sub(s, n), sub(r, l)
            q = norm((a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]))
            result.append(q if q[2] >= 0 else (-q[0], -q[1], -q[2]))
    return result


def indices(size):
    out = []
    for row in range(size - 1):
        for col in range(size - 1):
            a, b, c, d = row * size + col, row * size + col + 1, (row + 1) * size + col, (row + 1) * size + col + 1
            out.extend((a, c, b, b, c, d))
    return out


def pad4(data): return data + b"\0" * ((4 - len(data) % 4) % 4)


def glb(vertices, vertex_normals, index_data):
    positions = b"".join(struct.pack("<3f", *v) for v in vertices)
    normals_data = b"".join(struct.pack("<3f", *v) for v in vertex_normals)
    indices_data = b"".join(struct.pack("<I", i) for i in index_data)
    normal_off, index_off = len(positions), len(positions) + len(normals_data)
    binary = pad4(positions + normals_data + indices_data)

    def acc(view, component, count, typ, lo=None, hi=None):
        d = {"bufferView": view, "componentType": component, "count": count, "type": typ}
        if lo is not None: d["min"], d["max"] = lo, hi
        return d

    lo = [min(v[i] for v in vertices) for i in range(3)]
    hi = [max(v[i] for v in vertices) for i in range(3)]
    doc = {
        "asset": {"version": "2.0", "generator": "TSM deterministic terrain 3D Tiles converter"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "mode": 4, "material": 0}]}],
        "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [0.48, 0.52, 0.45, 1], "metallicFactor": 0, "roughnessFactor": 0.92}}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(positions), "target": 34962},
            {"buffer": 0, "byteOffset": normal_off, "byteLength": len(normals_data), "target": 34962},
            {"buffer": 0, "byteOffset": index_off, "byteLength": len(indices_data), "target": 34963},
        ],
        "accessors": [acc(0, 5126, len(vertices), "VEC3", lo, hi), acc(1, 5126, len(vertices), "VEC3"), acc(2, 5125, len(index_data), "SCALAR")],
    }
    js = pad4(json.dumps(doc, separators=(",", ":")).encode())
    cj, cb = struct.pack("<I4s", len(js), b"JSON") + js, struct.pack("<I4s", len(binary), b"BIN\0") + binary
    return struct.pack("<4sII", b"glTF", 2, 12 + len(cj) + len(cb)) + cj + cb


def write_hashes(root: Path, files: Iterable[Path]):
    (root / "SHA256SUMS").write_text("".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(root).as_posix()}\n" for p in sorted(files)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mbtiles", required=True, type=Path)
    ap.add_argument("--out-dir", required=True, type=Path)
    ap.add_argument("--grid-size", type=int, default=33)
    ap.add_argument("--source-url", default="https://www.usgs.gov/3d-elevation-program")
    ap.add_argument("--source-version", default="USGS 3DEP-derived screening terrain")
    args = ap.parse_args()
    if args.grid_size < 3 or args.grid_size > 129 or args.grid_size % 2 == 0:
        raise SystemExit("--grid-size must be odd and between 3 and 129")
    args.out_dir.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(args.mbtiles)
    metadata = dict(con.execute("SELECT name, value FROM metadata"))
    rows = con.execute("SELECT zoom_level,tile_column,tile_row,tile_data FROM tiles ORDER BY zoom_level,tile_column,tile_row").fetchall()
    con.close()
    if not rows or metadata.get("format") != "png":
        raise SystemExit("expected non-empty PNG MBTiles")
    records, paths, levels = {}, [], set()
    for z, x, yt, blob in rows:
        key = TileKey(z, x, (2 ** z - 1) - yt)
        image = read_png_rgb(blob)
        if (image.width, image.height) != (256, 256): raise SystemExit(f"{key} is not 256x256")
        verts, hs, axes, origin = make_grid(image, key, args.grid_size)
        path = args.out_dir / str(z) / str(x) / f"{key.y}.glb"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(glb(verts, normals(verts, args.grid_size), indices(args.grid_size)))
        paths.append(path); levels.add(z)
        center = tuple((min(v[i] for v in verts) + max(v[i] for v in verts)) / 2 for i in range(3))
        half = tuple(max((max(v[i] for v in verts) - min(v[i] for v in verts)) / 2, 0.5 if i == 2 else 0.0) for i in range(3))
        records[key] = {"key": key, "uri": path.relative_to(args.out_dir).as_posix(), "center": center, "half": half, "children": [], "min": min(hs), "max": max(hs)}
    levels = sorted(levels)
    if levels != list(range(levels[0], levels[-1] + 1)): raise SystemExit(f"non-contiguous zoom levels: {levels}")
    for r in records.values():
        k = r["key"]
        r["children"] = [c for c in (TileKey(k.z + 1, k.x * 2, k.y * 2), TileKey(k.z + 1, k.x * 2 + 1, k.y * 2), TileKey(k.z + 1, k.x * 2, k.y * 2 + 1), TileKey(k.z + 1, k.x * 2 + 1, k.y * 2 + 1)) if c in records]
        r["geometricError"] = 0 if not r["children"] else math.sqrt(sum(v * v for v in r["half"]))
    def box(r):
        c, h = r["center"], r["half"]
        return [c[0], c[1], c[2], h[0], 0, 0, 0, h[1], 0, 0, 0, h[2]]
    def node(r):
        d = {"boundingVolume": {"box": box(r)}, "geometricError": r["geometricError"], "refine": "REPLACE", "content": {"uri": r["uri"]}}
        if r["children"]: d["children"] = [node(records[c]) for c in r["children"]]
        return d
    roots = [r for r in records.values() if r["key"].z == levels[0]]
    ext = [[r["center"][i] - r["half"][i], r["center"][i] + r["half"][i]] for r in roots for i in range(3)]
    mins = [min(ext[i::3]) for i in range(3)]
    maxs = [max(ext[i::3]) for i in range(3)]
    root_center = [(mins[i] + maxs[i]) / 2 for i in range(3)]
    root_half = [(maxs[i] - mins[i]) / 2 for i in range(3)]
    root = {"boundingVolume": {"box": root_center + [root_half[0],0,0,0,root_half[1],0,0,0,root_half[2]]}, "geometricError": max(r["geometricError"] for r in roots), "refine": "REPLACE", "children": [node(r) for r in roots]}
    tileset = {"asset": {"version": "1.1", "extras": {"tsm": {"authorityClass": "DERIVED", "engineeringUse": False, "regulatoryUse": False}}}, "geometricError": root["geometricError"], "root": root}
    (args.out_dir / "tileset.json").write_text(json.dumps(tileset, indent=2) + "\n")
    manifest = {"schemaVersion":"1.0.0","artifactId":"tsm-terrain-3d-tiles-3dep","format":"OGC 3D Tiles 1.1 + glTF 2.0 GLB","source":{"sourceUrl":args.source_url,"sourceVersionOrEffectiveDate":args.source_version,"sourceId":metadata.get("name","terrain_3dep")},"input":{"mbtilesSha256":hashlib.sha256(args.mbtiles.read_bytes()).hexdigest(),"tileCount":len(rows),"zoomLevels":levels},"transformation":"Terrain-RGB PNG -> deterministic sampled mesh -> tile-local ENU GLB; WGS84 surface horizontal placement; NAVD88 elevation retained as visualization vertical offset without vertical datum conversion.","softwareVersion":"TSM deterministic terrain 3D Tiles converter v1","authorityClass":"DERIVED","engineeringUse":False,"regulatoryUse":False,"tileCount":len(rows),"gridSize":args.grid_size,"content":sorted(p.relative_to(args.out_dir).as_posix() for p in paths)}
    (args.out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    write_hashes(args.out_dir, paths + [args.out_dir / "tileset.json", args.out_dir / "manifest.json"])
    print(f"generated {len(rows)} GLBs; zooms={levels}; grid={args.grid_size}; out={args.out_dir}")


if __name__ == "__main__":
    main()
