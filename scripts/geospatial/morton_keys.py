#!/usr/bin/env python3
"""Morton Z-order keys for OGC 3D Tiles 1.1 implicit tiling (quadtree/octree)."""

from __future__ import annotations


def _part1by1(n: int) -> int:
    n &= 0x0000FFFF
    n = (n | (n << 8)) & 0x00FF00FF
    n = (n | (n << 4)) & 0x0F0F0F0F
    n = (n | (n << 2)) & 0x33333333
    n = (n | (n << 1)) & 0x55555555
    return n


def _part1by2(n: int) -> int:
    n &= 0x000003FF
    n = (n | (n << 16)) & 0xFF0000FF
    n = (n | (n << 8)) & 0x0F00F00F
    n = (n | (n << 4)) & 0xC30C30C3
    n = (n | (n << 2)) & 0x49249249
    return n


def morton_encode2(x: int, y: int) -> int:
    if x < 0 or y < 0:
        raise ValueError("x,y must be >= 0")
    return _part1by1(x) | (_part1by1(y) << 1)


def morton_encode3(x: int, y: int, z: int) -> int:
    if x < 0 or y < 0 or z < 0:
        raise ValueError("x,y,z must be >= 0")
    return _part1by2(x) | (_part1by2(y) << 1) | (_part1by2(z) << 2)


def morton_decode2(code: int) -> tuple[int, int]:
    def compact(n: int) -> int:
        n &= 0x55555555
        n = (n | (n >> 1)) & 0x33333333
        n = (n | (n >> 2)) & 0x0F0F0F0F
        n = (n | (n >> 4)) & 0x00FF00FF
        n = (n | (n >> 8)) & 0x0000FFFF
        return n

    return compact(code), compact(code >> 1)


def tile_count_at_level(level: int, dimensions: int = 2) -> int:
    if level < 0:
        raise ValueError("level >= 0")
    return 1 << (dimensions * level)


def child_morton_range(parent_level: int, parent_x: int, parent_y: int) -> tuple[int, int]:
    cx, cy = parent_x * 2, parent_y * 2
    codes = [morton_encode2(cx + dx, cy + dy) for dx in (0, 1) for dy in (0, 1)]
    return min(codes), max(codes)


if __name__ == "__main__":
    assert morton_encode2(0, 0) == 0
    assert morton_decode2(morton_encode2(3, 5)) == (3, 5)
    print("morton_keys OK", morton_encode2(3, 5), child_morton_range(0, 0, 0))
