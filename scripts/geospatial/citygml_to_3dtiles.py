#!/usr/bin/env python3
"""
CityGML 3.0 to source-linked 3D building feature staging for TSM

Parses CityGML 3.0 Space/SpaceBoundary elements and converts them
to a metadata-only candidate for subsequent meshing.

Usage:
    python citygml_to_3dtiles.py input.gml --output ./tiles/
    python citygml_to_3dtiles.py input.gml --output ./tiles/ --lod 2

Supports:
- Building (with BuildingParts)
- BuildingInstallation (doors, windows as components)
- Room (interior spaces, scale-invariant per CityGML 3.0)
- SpaceBoundary surfaces (WallSurface, RoofSurface, GroundSurface)

Output:
- citygml-features.candidate.json (NOT a renderable 3D Tiles tileset)
- 16-bit TSM state-word per source feature
No GLBs, implicit subtrees, topology or geodetic transforms are produced.
"""

import argparse
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

# CityGML 3.0 namespaces
NS = {
    'core': 'http://www.opengis.net/citygml/3.0',
    'bldg': 'http://www.opengis.net/citygml/building/3.0',
    'gml': 'http://www.opengis.net/gml/3.2',
}

# TSM state-word defaults for CityGML features
# B=3 (high quality), D=2 (LOD2), C=1 (basic components),
# T=2 (textured), S=3 (full semantics)
DEFAULT_STATE_WORD = (3 << 14) | (2 << 12) | (1 << 9) | (2 << 6) | (3 << 3)


@dataclass
class SpaceBoundary:
    """A bounding surface of a Space (wall, roof, ground, etc.)"""
    surface_type: str  # WallSurface, RoofSurface, GroundSurface, etc.
    polygon_coords: list  # List of (x, y, z) tuples
    lod: int = 2


@dataclass
class Space:
    """A volumetric space (building, room, etc.) per CityGML 3.0"""
    gml_id: str
    space_type: str  # Building, BuildingPart, Room, etc.
    boundaries: list = field(default_factory=list)
    attributes: dict = field(default_factory=dict)
    state_word: int = DEFAULT_STATE_WORD


def parse_polygon(poly_elem) -> list:
    """Extract 3D coordinates from a GML Polygon"""
    coords = []
    # Handle gml:posList
    for pos_list in poly_elem.iter(f"{{{NS['gml']}}}posList"):
        values = list(map(float, pos_list.text.strip().split()))
        dim = 3  # Assume 3D
        for i in range(0, len(values), dim):
            coords.append(tuple(values[i:i+dim]))
    # Handle gml:pos (individual positions)
    for pos in poly_elem.iter(f"{{{NS['gml']}}}pos"):
        values = list(map(float, pos.text.strip().split()))
        coords.append(tuple(values))
    return coords


def parse_space_boundary(elem) -> Optional[SpaceBoundary]:
    """Parse a CityGML 3.0 space boundary surface"""
    # Determine surface type from element tag
    tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag

    # Find polygon geometry
    coords = []
    for poly in elem.iter(f"{{{NS['gml']}}}Polygon"):
        coords = parse_polygon(poly)
        break

    if not coords:
        return None

    return SpaceBoundary(
        surface_type=tag,
        polygon_coords=coords,
    )


def parse_building(bldg_elem) -> Space:
    """Parse a CityGML 3.0 Building element into a TSM Space"""
    gml_id = bldg_elem.get(f"{{{NS['gml']}}}id", "unknown")

    space = Space(gml_id=gml_id, space_type="Building")

    # Parse attributes
    for attr in ['measuredHeight', 'storeysAboveGround', 'storeysBelowGround']:
        elem = bldg_elem.find(f"bldg:{attr}", NS)
        if elem is not None and elem.text:
            space.attributes[attr] = elem.text.strip()

    # Parse space boundaries (boundedBy surfaces)
    for bounded_by in bldg_elem.iter(f"{{{NS['core']}}}boundedBy"):
        for child in bounded_by:
            boundary = parse_space_boundary(child)
            if boundary:
                space.boundaries.append(boundary)

    # Parse building parts
    for part in bldg_elem.findall("bldg:consistsOfBuildingPart", NS):
        # Recursively parse parts (simplified - just count for now)
        space.attributes.setdefault('part_count', 0)
        space.attributes['part_count'] += 1

    return space


def parse_citygml(input_path: Path) -> list:
    """Parse a CityGML 3.0 file and return list of Spaces"""
    tree = ET.parse(input_path)
    root = tree.getroot()

    spaces = []

    # Find all buildings
    for bldg in root.iter(f"{{{NS['bldg']}}}Building"):
        space = parse_building(bldg)
        spaces.append(space)

    return spaces


def space_to_gltf_feature(space: Space) -> dict:
    """Convert a Space to a 3D Tiles 1.1 feature with metadata"""
    return {
        "id": space.gml_id,
        "type": space.space_type,
        "stateWord": space.state_word,
        "boundaryCount": len(space.boundaries),
        "attributes": space.attributes,
        # Note: Actual GLB geometry generation requires a mesh builder.
        # This produces the metadata structure; geometry is built
        # separately via the LOD2 pipeline.
    }


def write_tileset(spaces: list, output_dir: Path):
    """Stage source-linked feature metadata; never advertise renderable 3D Tiles.

    Kept as a compatibility entry point for importer callers. Only an actual
    geometry-meshing and validation stage may publish tileset.json.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    features = [space_to_gltf_feature(s) for s in spaces]
    candidate = {
        "schema": "tsm.citygml-features.candidate.v1",
        "sourceFormat": "CityGML 3.0",
        "renderable": False,
        "valid3DTiles": False,
        "assetType": "METADATA_ONLY",
        "featureCount": len(features),
        "features": features,
        "blockers": [
            "GLB_GEOMETRY_NOT_GENERATED",
            "ROOT_TILE_BOUNDING_VOLUME_NOT_GENERATED",
            "ROOT_TILE_TRANSFORM_NOT_GENERATED",
            "IMPLICIT_SUBTREES_NOT_GENERATED",
            "CRS_DATUM_AND_UNITS_NOT_VERIFIED",
            "MESH_SEAMS_AND_BUILDING_TOPOLOGY_NOT_VERIFIED",
        ],
    }
    # Reject stale deceptive tilesets instead of leaving them in packaging output.
    tileset = output_dir / "tileset.json"
    if tileset.exists() or tileset.is_symlink():
        raise ValueError(
            "Output contains tileset.json: refusing to overwrite or retain "
            "an unverified renderable tileset alongside a metadata-only candidate"
        )
    target = output_dir / "citygml-features.candidate.json"
    with target.open("x", encoding="utf-8") as out:
        json.dump(candidate, out, indent=2, allow_nan=False)
        out.write("\\n")
    print(f"Staged {len(features)} feature metadata records to {target}; no renderable 3D Tiles emitted")


def main():
    parser = argparse.ArgumentParser(
        description="Convert CityGML 3.0 to OGC 3D Tiles 1.1 for TSM"
    )
    parser.add_argument("input", type=Path, help="Input CityGML 3.0 file (.gml)")
    parser.add_argument("--output", type=Path, default=Path("./tiles"),
                        help="Output directory for 3D Tiles")
    parser.add_argument("--lod", type=int, default=2,
                        help="Target LOD level (1-3)")

    args = parser.parse_args()

    if not args.input.exists():
        print(f"Error: {args.input} not found", file=sys.stderr)
        sys.exit(1)

    print(f"Parsing {args.input}...")
    spaces = parse_citygml(args.input)
    print(f"Found {len(spaces)} CityGML spaces")

    # Set D (geometric detail) from requested LOD
    for space in spaces:
        # Clear D bits (12-14) and set new value
        space.state_word = (space.state_word & ~(0x7 << 12)) | ((args.lod & 0x7) << 12)

    write_tileset(spaces, args.output)
    print("Metadata staging complete; independent meshing/3D Tiles validation required.")


if __name__ == "__main__":
    main()
