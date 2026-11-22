"""Per-vertex geoid/ECEF terrain placement contracts (synthetic, not engineering acceptance)."""
from __future__ import annotations
import importlib.util
import math
import struct
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).with_name("build-terrain-3d-tiles.py")
SPEC = importlib.util.spec_from_file_location("tsm_terrain_tiles_geodesy", SCRIPT)
assert SPEC and SPEC.loader
terrain = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = terrain
SPEC.loader.exec_module(terrain)

HEIGHT_M = 110.6


class SyntheticGeoid:
    """Deliberately varying geoid exposes reliance on a tile-center-only offset."""
    def separation_m(self, lon, lat):
        return -30.0 + 0.5 * (lon + 88.0) + 0.1 * (lat - 38.0), False


def key_near_posey():
    z = 11
    x = int((-88.0 + 180.0) / 360.0 * (2 ** z))
    y = int((1.0 - math.asinh(math.tan(math.radians(38.0))) / math.pi) / 2 * 2 ** z)
    return terrain.TileKey(z, x, y)


def constant_image(height_m=HEIGHT_M):
    value = round((height_m + 10000.0) * 10.0)
    rgb = bytes([(value >> 16) & 255, (value >> 8) & 255, value & 255])
    return terrain.RGBImage(256, 256, rgb * (256 * 256))


def world(vertex, axes, origin):
    return tuple(origin[i] + sum(vertex[j] * axes[j][i] for j in range(3)) for i in range(3))


def test_geodetic_vertices_match_direct_ecef_at_each_point():
    key = key_near_posey()
    image = constant_image()
    geoid = SyntheticGeoid()
    vertices, heights, axes, origin = terrain.make_grid(image, key, 3, geoid=geoid)
    west, south, east, north = terrain.xyz_bounds(key)
    assert len(vertices) == len(heights) == 9
    for row in range(3):
        lat = north + (south - north) * row / 2.0
        for col in range(3):
            lon = west + (east - west) * col / 2.0
            actual = world(vertices[row * 3 + col], axes, origin)
            undulation, _ = geoid.separation_m(lon, lat)
            expected = terrain.ellipsoidal_to_ecef(lon, lat, HEIGHT_M + undulation)
            assert math.dist(actual, expected) < 1e-5


def test_identical_neighbor_dem_edge_has_no_geodetic_tile_seam():
    key = key_near_posey()
    adjacent = terrain.TileKey(key.z, key.x + 1, key.y)
    image = constant_image()
    geoid = SyntheticGeoid()
    left, _, left_axes, left_origin = terrain.make_grid(image, key, 3, geoid=geoid)
    right, _, right_axes, right_origin = terrain.make_grid(image, adjacent, 3, geoid=geoid)
    for row in range(3):
        left_world = world(left[row * 3 + 2], left_axes, left_origin)
        right_world = world(right[row * 3], right_axes, right_origin)
        assert math.dist(left_world, right_world) < 1e-5


def test_legacy_preview_retains_old_planar_local_z():
    image = constant_image()
    vertices, heights, _, _ = terrain.make_grid(image, key_near_posey(), 3,
                                                vertical_mode="legacy-offset",
                                                geoid=SyntheticGeoid())
    assert all(math.isclose(v[2], HEIGHT_M, abs_tol=0.00001) for v in vertices)
    assert all(math.isclose(h, HEIGHT_M, abs_tol=0.00001) for h in heights)


def test_geodetic_float32_roundtrip_keeps_shared_edge_under_5mm():
    key = key_near_posey()
    adjacent = terrain.TileKey(key.z, key.x + 1, key.y)
    image = constant_image()
    geoid = SyntheticGeoid()
    left, _, left_axes, left_origin = terrain.make_grid(image, key, 3, geoid=geoid)
    right, _, right_axes, right_origin = terrain.make_grid(image, adjacent, 3, geoid=geoid)
    def f32(vec):
        return tuple(struct.unpack("<f", struct.pack("<f", component))[0] for component in vec)
    for row in range(3):
        a = world(f32(left[row * 3 + 2]), left_axes, left_origin)
        b = world(f32(right[row * 3]), right_axes, right_origin)
        assert math.dist(a, b) < 0.005  # serialization, not survey uncertainty
