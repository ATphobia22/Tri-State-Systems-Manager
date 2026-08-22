#!/usr/bin/env python3
"""Minimal local tile server for PTDT development and offline field use.

Supports:
  /tiles/{z}/{x}/{y}.png  -> XYZ directory tiles or MBTiles
  /healthz                 -> liveness

The server is intentionally local-first. It does not proxy arbitrary URLs.
"""
from __future__ import annotations

import argparse
import mimetypes
import os
import sqlite3
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


class TileBackend:
    def __init__(self, root: Path, mbtiles: Path | None) -> None:
        self.root = root.resolve()
        self.mbtiles = mbtiles.resolve() if mbtiles else None
        if self.mbtiles and not self.mbtiles.is_file():
            raise FileNotFoundError(self.mbtiles)

    def get_tile(self, z: int, x: int, y: int) -> bytes | None:
        if min(z, x, y) < 0:
            return None
        max_index = (1 << z) - 1
        if x > max_index or y > max_index:
            return None

        if self.mbtiles:
            # MBTiles stores rows in TMS order; HTTP clients request XYZ.
            tms_y = max_index - y
            with sqlite3.connect(f"file:{self.mbtiles}?mode=ro", uri=True) as connection:
                row = connection.execute(
                    "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?",
                    (z, x, tms_y),
                ).fetchone()
                return bytes(row[0]) if row else None

        candidate = (self.root / str(z) / str(x) / f"{y}.png").resolve()
        if self.root not in candidate.parents:
            return None
        if not candidate.is_file():
            return None
        return candidate.read_bytes()


class TileHandler(BaseHTTPRequestHandler):
    backend: TileBackend

    def _headers(self, content_type: str, length: int) -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control", "public, max-age=86400, immutable")
        self.send_header("Access-Control-Allow-Origin", os.environ.get("PTDT_TILE_CORS", "*"))
        self.send_header("X-Content-Type-Options", "nosniff")

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/healthz":
            body = b"ok\n"
            self.send_response(HTTPStatus.OK)
            self._headers("text/plain; charset=utf-8", len(body))
            self.end_headers()
            self.wfile.write(body)
            return

        parts = path.strip("/").split("/")
        if len(parts) != 4 or parts[0] != "tiles" or not parts[3].endswith(".png"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        try:
            z = int(parts[1])
            x = int(parts[2])
            y = int(parts[3][:-4])
            tile = self.backend.get_tile(z, x, y)
        except (ValueError, OSError, sqlite3.Error):
            self.send_error(HTTPStatus.BAD_REQUEST)
            return

        if tile is None:
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        self.send_response(HTTPStatus.OK)
        self._headers("image/png", len(tile))
        self.end_headers()
        self.wfile.write(tile)

    def log_message(self, format: str, *args: object) -> None:
        print(f"[tile-server] {format % args}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--tile-root", type=Path, default=Path("data/tiles"))
    parser.add_argument("--mbtiles", type=Path)
    args = parser.parse_args()

    backend = TileBackend(args.tile_root, args.mbtiles)
    handler = TileHandler
    handler.backend = backend
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"PTDT tile server listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
