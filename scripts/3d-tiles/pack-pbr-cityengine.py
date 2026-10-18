#!/usr/bin/env python3
"""Pack TSM separate PBR maps into glTF 2.0 / CityEngine channel-packed textures.

TSM's bake-pbr-standard.py emits five separate maps:
    <name>_albedo.png      sRGB
    <name>_normal.png      linear, tangent-space RGB (OpenGL, +Y up)
    <name>_roughness.png   linear, grayscale
    <name>_metallic.png    linear, grayscale
    <name>_ao.png          linear, grayscale

CityEngine and glTF 2.0 expect packed textures:
    <name>_metallicRoughness.png   RGB: G=roughness, B=metallic (R,A ignored)
    <name>_occlusion.png           RGB: R=ao (G,B ignored)

In CGA, point both roughnessmap and metallicmap at the packed file --
CityEngine samples the G and B channels respectively, exactly like glTF.

Usage:
    python pack-pbr-cityengine.py --prefix ./out/wall
        # reads ./out/wall_roughness.png, ./out/wall_metallic.png,
        #         ./out/wall_ao.png
        # writes ./out/wall_metallicRoughness.png, ./out/wall_occlusion.png

Requires: Pillow  (pip install Pillow)
"""
import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow is required: pip install Pillow", file=sys.stderr)
    sys.exit(1)


def pack_metallic_roughness(rough_path: Path, metal_path: Path, out_path: Path):
    rough = Image.open(rough_path).convert("L")
    metal = Image.open(metal_path).convert("L")
    if rough.size != metal.size:
        raise ValueError(
            f"resolution mismatch: {rough_path} {rough.size} vs "
            f"{metal_path} {metal.size}"
        )
    # R=0 (unused), G=roughness, B=metallic  -- glTF/CityEngine convention
    packed = Image.merge("RGB", (
        Image.new("L", rough.size, 0),
        rough,
        metal,
    ))
    packed.save(out_path)
    print(f"wrote {out_path}  (G=roughness, B=metallic)")


def pack_occlusion(ao_path: Path, out_path: Path):
    ao = Image.open(ao_path).convert("L")
    blank = Image.new("L", ao.size, 0)
    # R=ao, G=0, B=0  -- glTF occlusionTexture reads R only
    packed = Image.merge("RGB", (ao, blank, blank))
    packed.save(out_path)
    print(f"wrote {out_path}  (R=occlusion)")


def main():
    ap = argparse.ArgumentParser(
        description="Pack TSM PBR maps to glTF 2.0 / CityEngine channel convention"
    )
    ap.add_argument(
        "--prefix", required=True,
        help="Path prefix, e.g. ./out/wall  (reads wall_roughness.png etc.)",
    )
    args = ap.parse_args()

    p = Path(args.prefix)
    d = p.parent
    n = p.name

    for suffix in ("_roughness.png", "_metallic.png", "_ao.png"):
        src = d / f"{n}{suffix}"
        if not src.exists():
            print(f"ERROR: missing input {src}", file=sys.stderr)
            sys.exit(1)

    pack_metallic_roughness(
        d / f"{n}_roughness.png",
        d / f"{n}_metallic.png",
        d / f"{n}_metallicRoughness.png",
    )
    pack_occlusion(
        d / f"{n}_ao.png",
        d / f"{n}_occlusion.png",
    )


if __name__ == "__main__":
    main()
