"""Headless RVT resolution/geometry QA shared by editor authoring documentation."""
from __future__ import annotations

from math import isfinite

DEFAULT_PROFILE = {"tile_size_px": 128, "log2_tiles": 8, "border_px": 4}
DEFAULT_AREA_M = 8000.0


def virtual_resolution(tile_size_px: int, log2_tiles: int, *, world_size_m=DEFAULT_AREA_M):
    """Return virtual address space metrics, NOT resident VRAM estimates."""
    if tile_size_px not in (128, 256):
        raise ValueError("Only reviewed 128px/256px tile profiles are accepted")
    if not isinstance(log2_tiles, int) or isinstance(log2_tiles, bool) or log2_tiles < 5 or log2_tiles > 10:
        raise ValueError("log2_tiles must be integer 5 to 10")
    if not isfinite(world_size_m) or world_size_m <= 0:
        raise ValueError("world_size_m must be positive finite")
    tiles_across = 1 << log2_tiles
    pixels_across = tiles_across * tile_size_px
    return {
        "tiles_across": tiles_across,
        "virtual_pixels_across": pixels_across,
        "meters_per_texel": world_size_m / pixels_across,
        "virtual_texels": pixels_across ** 2,
        "physical_vram_estimate": None,
        "requires_gpu_benchmark": True,
    }


def foundation_blend_alpha(pixel_z_cm: float, ground_z_cm: float,
                           blend_height_cm=35.0, exponent=1.5):
    """RVT contact: 0=ground surface colour, 1=original wall colour."""
    vals = (pixel_z_cm, ground_z_cm, blend_height_cm, exponent)
    if not all(isfinite(x) for x in vals) or blend_height_cm <= 0 or exponent <= 0:
        raise ValueError("height/exponent inputs must be finite and positive where needed")
    delta = pixel_z_cm - ground_z_cm
    return min(1.0, max(0.0, delta / blend_height_cm)) ** exponent


def road_edge_alpha(vertex_red: float, pixel_z_cm: float, ground_z_cm: float,
                    max_contact_delta_cm=20.0):
    """RVT edge: keep asphalt where height mismatch means edge blending unsafe."""
    vals = (vertex_red, pixel_z_cm, ground_z_cm, max_contact_delta_cm)
    if not all(isfinite(x) for x in vals) or max_contact_delta_cm <= 0:
        raise ValueError("Invalid road RVT blend settings")
    if not 0.0 <= vertex_red <= 1.0:
        raise ValueError("road vertex R must be [0,1]")
    return min(1.0, max(vertex_red, abs(pixel_z_cm-ground_z_cm)/max_contact_delta_cm))


def height_quantization_cm(volume_height_cm):
    """Worst 1-LSB vertical quantization for a WorldHeight R16_UNORM RVT."""
    if not isfinite(volume_height_cm) or volume_height_cm <= 0:
        raise ValueError("RVT height volume extent must be positive finite")
    return volume_height_cm / 65535.0
