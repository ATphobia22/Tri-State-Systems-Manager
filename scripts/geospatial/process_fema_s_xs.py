#!/usr/bin/env python3
"""Process FEMA S_XS (Cross Sections) shapefiles into clean Floodway Data Tables.

Reads an extracted FEMA S_XS shapefile, verifies geometry and CRS, extracts
key FEMA NFHL Technical Reference fields, and exports a clean tabular structure
suitable for Floodway Data Table generation.

FEMA NFHL schema fields handled:
    XS_LN_ID   - Cross-section line ID (primary key)
    XS_LTR     - Letter marker (map designation)
    WTR_NM     - Waterway name
    STREAM_STN - Stream station (river stationing)
    WSEL_REG   - Regulatory water surface elevation
    LEN_UNIT   - Length units
    V_DATUM    - Vertical datum
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def process_fema_cross_sections(shapefile_path, output_csv_path=None):
    """Read a FEMA S_XS shapefile and extract hydraulic data fields.

    Args:
        shapefile_path: Path to the S_XS.shp file (with .dbf, .shx, .prj alongside).
        output_csv_path: Optional path for flat CSV export.

    Returns:
        GeoDataFrame with cleaned cross-section data.
    """
    try:
        import geopandas as gpd
        import pandas as pd
    except ImportError:
        print("ERROR: geopandas is required (pip install geopandas)", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(shapefile_path):
        raise FileNotFoundError(f"Could not find the shapefile at: {shapefile_path}")

    print(f"Reading FEMA S_XS Shapefile: {os.path.basename(shapefile_path)}...")

    # Read with pyogrio for speed, fallback to fiona
    try:
        gdf = gpd.read_file(shapefile_path, engine="pyogrio")
    except Exception:
        gdf = gpd.read_file(shapefile_path)

    print(f"Loaded {len(gdf)} cross-section records.")
    print(f"Native CRS: {gdf.crs}")

    # Normalize column case (FEMA sources vary)
    gdf.columns = [col.upper() for col in gdf.columns]

    expected_fields = {
        'XS_LN_ID': 'Cross_Section_ID',
        'XS_LTR': 'Letter_Marker',
        'WTR_NM': 'Waterway_Name',
        'STREAM_STN': 'Stream_Station',
        'WSEL_REG': 'Regulatory_WSEL',
        'LEN_UNIT': 'Length_Units',
        'V_DATUM': 'Vertical_Datum',
    }

    available_fields = {k: v for k, v in expected_fields.items() if k in gdf.columns}
    missing = set(expected_fields) - set(available_fields)
    if missing:
        print(f"Warning: missing expected fields: {sorted(missing)}")

    columns_to_keep = list(available_fields.keys()) + ['geometry']
    sub_gdf = gdf[columns_to_keep].rename(columns=available_fields)

    # Sort by waterway, then downstream (highest station first)
    if 'Waterway_Name' in sub_gdf.columns and 'Stream_Station' in sub_gdf.columns:
        sub_gdf['Stream_Station'] = pd.to_numeric(sub_gdf['Stream_Station'], errors='coerce')
        sub_gdf = sub_gdf.sort_values(
            by=['Waterway_Name', 'Stream_Station'], ascending=[True, False])

    # GIS-calculated width (requires projected CRS)
    if sub_gdf.crs and sub_gdf.crs.is_projected:
        sub_gdf['GIS_Calculated_Length'] = sub_gdf['geometry'].length
    else:
        sub_gdf['GIS_Calculated_Length'] = "N/A (project CRS to calculate)"

    if output_csv_path:
        df_flat = pd.DataFrame(sub_gdf.drop(columns='geometry'))
        df_flat.to_csv(output_csv_path, index=False)
        print(f"Exported to CSV: {output_csv_path}")

    return sub_gdf


def main():
    import argparse
    p = argparse.ArgumentParser(description="Process FEMA S_XS cross-section shapefile")
    p.add_argument("shapefile", help="Path to S_XS.shp")
    p.add_argument("--output", "-o", default=None, help="Output CSV path")
    p.add_argument("--head", type=int, default=10, help="Preview rows to print")
    args = p.parse_args()

    try:
        result = process_fema_cross_sections(args.shapefile, args.output)
        cols = [c for c in ['Letter_Marker', 'Waterway_Name', 'Stream_Station',
                            'Regulatory_WSEL'] if c in result.columns]
        print(f"\nPreview ({args.head} rows):")
        print(result[cols].head(args.head).to_string())
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
