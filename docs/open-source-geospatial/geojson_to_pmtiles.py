#!/usr/bin/env python3
"""
GeoJSON → MVT → PMTiles converter for TSM.

Converts a small GeoJSON FeatureCollection into a PMTiles v3 archive
containing Mapbox Vector Tiles. No tippecanoe required — uses pure Python.

Usage:
    ./venv/bin/python geojson_to_pmtiles.py input.geojson output.pmtiles

Dependencies (all open source, no account required):
    pip install pmtiles mapbox-vector-tile
"""

import gzip
import json
import math
import sys

import mapbox_vector_tile
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer


def lonlat_to_tile(lon, lat, zoom):
    """Convert lon/lat to web mercator tile coordinates."""
    n = 2.0 ** zoom
    xtile = int((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return xtile, ytile


def lonlat_to_tile_pixel(lon, lat, zoom, extent=4096):
    """Convert lon/lat to tile + pixel coordinates within tile."""
    n = 2.0 ** zoom
    x_frac = (lon + 180.0) / 360.0 * n
    lat_rad = math.radians(lat)
    y_frac = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n
    xtile = int(x_frac)
    ytile = int(y_frac)
    px = int((x_frac - xtile) * extent)
    py = int((y_frac - ytile) * extent)
    return xtile, ytile, px, py


def geojson_to_mvt_layers(features, zoom):
    """
    Group GeoJSON features by tile and encode as MVT.
    Returns dict: (z, x, y) -> mvt bytes
    """
    tiles = {}  # (z, x, y) -> list of (layer_name, feature)

    for feature in features:
        geom = feature.get("geometry", {})
        props = dict(feature.get("properties", {}))
        gtype = geom.get("type")
        coords = geom.get("coordinates", [])

        if gtype == "Point":
            lon, lat = coords
            xtile, ytile, px, py = lonlat_to_tile_pixel(lon, lat, zoom)
            mvt_geom = {"type": "Point", "coordinates": [px, py]}
            tiles.setdefault((zoom, xtile, ytile), []).append(
                ("points", {"geometry": mvt_geom, "properties": props})
            )
        elif gtype == "Polygon":
            # Use first ring, convert all coords to tile pixels
            ring = coords[0] if coords else []
            if not ring:
                continue
            # Determine tile from first coordinate
            xtile, ytile, _, _ = lonlat_to_tile_pixel(ring[0][0], ring[0][1], zoom)
            pixel_rings = []
            for r in coords:
                pixel_ring = []
                for lon, lat in r:
                    _, _, px, py = lonlat_to_tile_pixel(lon, lat, zoom)
                    # Clamp to tile extent (features may cross tile boundaries)
                    px = max(0, min(4095, px))
                    py = max(0, min(4095, py))
                    pixel_ring.append([px, py])
                pixel_rings.append(pixel_ring)
            mvt_geom = {"type": "Polygon", "coordinates": pixel_rings}
            tiles.setdefault((zoom, xtile, ytile), []).append(
                ("polygons", {"geometry": mvt_geom, "properties": props})
            )

    # Encode each tile
    encoded = {}
    for tile_key, layer_features in tiles.items():
        layers = {}
        for layer_name, feat in layer_features:
            layers.setdefault(layer_name, []).append(feat)
        mvt_bytes = mapbox_vector_tile.encode(
            [{"name": name, "features": feats} for name, feats in layers.items()]
        )
        encoded[tile_key] = gzip.compress(mvt_bytes)

    return encoded


def write_pmtiles(tiles_dict, output_path, metadata=None):
    """Write MVT tiles to a PMTiles v3 archive."""
    min_zoom = min(t[0] for t in tiles_dict) if tiles_dict else 0
    max_zoom = max(t[0] for t in tiles_dict) if tiles_dict else 0

    with open(output_path, "wb") as f:
        writer = Writer(f)
        for (z, x, y), tile_data in sorted(tiles_dict.items()):
            writer.write_tile(zxy_to_tileid(z, x, y), tile_data)

        writer.finalize(
            {
                "tile_type": TileType.MVT,
                "tile_compression": Compression.GZIP,
                "min_zoom": min_zoom,
                "max_zoom": max_zoom,
                "min_lon_e7": int(-88.2 * 1e7),
                "min_lat_e7": int(37.6 * 1e7),
                "max_lon_e7": int(-87.8 * 1e7),
                "max_lat_e7": int(38.3 * 1e7),
                "center_zoom": min_zoom,
                "center_lon_e7": int(-88.005075 * 1e7),
                "center_lat_e7": int(37.845887 * 1e7),
            },
            metadata or {},
        )
    print(f"Wrote {len(tiles_dict)} tiles to {output_path}")


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} input.geojson output.pmtiles")
        sys.exit(1)

    input_path, output_path = sys.argv[1], sys.argv[2]

    with open(input_path) as f:
        geojson = json.load(f)

    features = geojson.get("features", [])
    print(f"Loaded {len(features)} features from {input_path}")

    # Generate tiles at zoom 10 (regional view)
    tiles = geojson_to_mvt_layers(features, zoom=10)
    print(f"Generated {len(tiles)} MVT tiles at z10")

    write_pmtiles(
        tiles,
        output_path,
        metadata={
            "name": "TSM Tri-State Demo",
            "description": "Demo PMTiles from TSM GeoJSON",
            "attribution": "Tri-State Systems Manager",
        },
    )


if __name__ == "__main__":
    main()
