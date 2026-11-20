#!/usr/bin/env python3
"""One-time checksum-enforced original music import. Never downloads network assets."""
from __future__ import annotations
import base64
import hashlib
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIO = ROOT / "tsm-console" / "public" / "audio"
STAGED = AUDIO / ".import"
# Filename, exact original byte count, expected SHA-256, expected chunk count.
SONGS = {
    "oak-grove-slim-days": ("oak-grove-slim-days.mp3", 5827577, "a81119c8bf5108ad0bc75b793195fee544dce9ec60ffef394cce05aad23c0403", 9),
    "mama-times-changed": ("mama-times-changed.mp3", 4910404, "918cde01e21852aab68c02d6faa95569a61ebb9c9feecca361094a227ee91650", 8),
    "home-sweet-home": ("home-sweet-home.mp3", 5107780, "940e0751f205f3a871fa15c3f29d8d89f05cb2764fc18c5af5cbee5fa0b79d20", 8),
    "creek-bank-jumpin": ("creek-bank-jumpin.mp3", 4085188, "77071a23f2148fd6553c31c8223287704178716c4802d1e1fb79e3b9ce41806d", 7),
}

def run() -> None:
    for slug, (filename, expected_size, expected_sha, part_count) in SONGS.items():
        directory = STAGED / slug
        expected_parts = [directory / f"{i:03d}.b64" for i in range(part_count)]
        actual_parts = sorted(directory.glob("*.b64"))
        if actual_parts != expected_parts:
            raise ValueError(f"{slug}: expected {part_count} consecutive parts; found {len(actual_parts)}")
        data = base64.b64decode(b"".join(p.read_bytes() for p in expected_parts), validate=True)
        digest = hashlib.sha256(data).hexdigest()
        if len(data) != expected_size or digest != expected_sha:
            raise ValueError(f"{slug}: SHA-256/byte count mismatch: {len(data)}, {digest}")
        if not (data.startswith(b"ID3") or (len(data) > 1 and data[0] == 0xff and (data[1] & 0xe0) == 0xe0)):
            raise ValueError(f"{slug}: not an MP3 stream")
        target = AUDIO / filename
        tmp = AUDIO / (filename + ".partial")
        try:
            tmp.write_bytes(data)
            os.replace(tmp, target)
        finally:
            tmp.unlink(missing_ok=True)
        print(f"Verified {filename}: {len(data)} bytes, sha256={digest}")

if __name__ == "__main__":
    run()
