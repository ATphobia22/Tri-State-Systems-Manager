#!/usr/bin/env python3
"""Bake discrete PBR maps into glTF 2.0 metallic-roughness atlas set.

Inputs (PNG/JPEG, same resolution, power-of-two recommended):
  --albedo, --normal, --roughness, --metallic, [--occlusion], [--emissive]

Outputs under --out-dir:
  baseColor.png, normal.png, metallicRoughness.png, occlusion.png?,
  atlas-manifest.json (tsm-pbr-atlas-v1)

ORM packing (glTF):
  R = occlusion (or 255), G = roughness, B = metallic, A = 255

Fail-closed: mismatched sizes, missing required maps, non-finite paths.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Pillow is required: pip install Pillow") from exc


def load_rgb(path: Path) -> Image.Image:
    if not path.is_file():
        raise FileNotFoundError(f"Missing texture: {path}")
    return Image.open(path).convert("RGB")


def load_gray(path: Path) -> Image.Image:
    if not path.is_file():
        raise FileNotFoundError(f"Missing texture: {path}")
    return Image.open(path).convert("L")


def assert_same_size(images: list[Image.Image], label: str) -> tuple[int, int]:
    w, h = images[0].size
    for im in images[1:]:
        if im.size != (w, h):
            raise ValueError(f"{label}: size mismatch {im.size} vs {(w, h)}")
    if w < 1 or h < 1:
        raise ValueError("Invalid image dimensions")
    return w, h


def pack_orm(roughness: Image.Image, metallic: Image.Image, occlusion: Image.Image | None) -> Image.Image:
    w, h = roughness.size
    r_pix = roughness.load()
    m_pix = metallic.load()
    o_pix = occlusion.load() if occlusion is not None else None
    out = Image.new("RGBA", (w, h))
    px = out.load()
    for y in range(h):
        for x in range(w):
            ao = o_pix[x, y] if o_pix is not None else 255
            px[x, y] = (ao, r_pix[x, y], m_pix[x, y], 255)
    return out


def is_power_of_two(n: int) -> bool:
    return n > 0 and (n & (n - 1)) == 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--name", required=True, help="Atlas logical name")
    p.add_argument("--out-dir", required=True, type=Path)
    p.add_argument("--albedo", required=True, type=Path)
    p.add_argument("--normal", required=True, type=Path)
    p.add_argument("--roughness", required=True, type=Path)
    p.add_argument("--metallic", required=True, type=Path)
    p.add_argument("--occlusion", type=Path, default=None)
    p.add_argument("--emissive", type=Path, default=None)
    p.add_argument("--allow-non-pot", action="store_true", help="Allow non power-of-two sizes")
    args = p.parse_args(argv)

    albedo = load_rgb(args.albedo)
    normal = load_rgb(args.normal)
    roughness = load_gray(args.roughness)
    metallic = load_gray(args.metallic)
    occlusion = load_gray(args.occlusion) if args.occlusion else None
    emissive = load_rgb(args.emissive) if args.emissive else None

    images: list[Image.Image] = [albedo, normal, roughness, metallic]
    if occlusion is not None:
        images.append(occlusion)
    if emissive is not None:
        images.append(emissive)
    w, h = assert_same_size(images, "PBR inputs")
    if not args.allow_non_pot and (not is_power_of_two(w) or not is_power_of_two(h)):
        raise SystemExit(f"Atlas size {w}x{h} must be power-of-two (or pass --allow-non-pot)")

    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    albedo.save(out_dir / "baseColor.png")
    normal.save(out_dir / "normal.png")
    pack_orm(roughness, metallic, occlusion).save(out_dir / "metallicRoughness.png")

    textures = {
        "baseColor": "baseColor.png",
        "normal": "normal.png",
        "metallicRoughness": "metallicRoughness.png",
    }
    if occlusion is not None:
        occlusion.save(out_dir / "occlusion.png")
        textures["occlusion"] = "occlusion.png"
    if emissive is not None:
        emissive.save(out_dir / "emissive.png")
        textures["emissive"] = "emissive.png"

    manifest = {
        "schema": "tsm-pbr-atlas-v1",
        "name": args.name,
        "width": w,
        "height": h,
        "textures": textures,
        "packing": {
            "metallicRoughness": "glTF_ORM",
            "normalSpace": "tangent",
            "colorSpace": "sRGB_baseColor_linear_others",
        },
        "authorityClass": "DERIVED",
        "engineeringUse": False,
        "regulatoryUse": False,
        "sources": {
            "albedo": str(args.albedo),
            "normal": str(args.normal),
            "roughness": str(args.roughness),
            "metallic": str(args.metallic),
            "occlusion": str(args.occlusion) if args.occlusion else None,
            "emissive": str(args.emissive) if args.emissive else None,
        },
    }
    manifest_path = out_dir / "atlas-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote PBR atlas '{args.name}' {w}x{h} → {out_dir}")
    print(f"Manifest: {manifest_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
