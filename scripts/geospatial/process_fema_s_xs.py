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


def filter_to_floodway(xs_gdf, fld_haz_path, zone_subtype="FLOODWAY"):
    """Spatial join: keep only cross-sections intersecting the floodway.

    Args:
        xs_gdf: GeoDataFrame of cross-sections (from process_fema_cross_sections).
        fld_haz_path: Path to S_Fld_Haz_Ar shapefile.
        zone_subtype: ZONE_SUBTY value to match (default "FLOODWAY").

    Returns:
        Filtered GeoDataFrame with only floodway-intersecting cross-sections.
    """
    try:
        import geopandas as gpd
    except ImportError:
        print("ERROR: geopandas is required", file=sys.stderr)
        sys.exit(1)

    print(f"Loading flood hazard zones from {fld_haz_path}...")
    try:
        haz = gpd.read_file(fld_haz_path, engine="pyogrio")
    except Exception:
        haz = gpd.read_file(fld_haz_path)

    haz.columns = [c.upper() for c in haz.columns]

    # Filter to floodway polygons
    if 'ZONE_SUBTY' in haz.columns:
        floodway = haz[haz['ZONE_SUBTY'].str.upper() == zone_subtype.upper()]
    elif 'FL_ZONE' in haz.columns:
        # Fallback: floodway is often encoded in FL_ZONE
        floodway = haz[haz['FL_ZONE'].str.contains('FW', na=False)]
    else:
        print("Warning: no ZONE_SUBTY or FL_ZONE column found, using all polygons")
        floodway = haz

    print(f"Found {len(floodway)} floodway polygons")

    # Ensure same CRS
    if xs_gdf.crs != floodway.crs:
        print(f"Reprojecting floodway from {floodway.crs} to {xs_gdf.crs}")
        floodway = floodway.to_crs(xs_gdf.crs)

    # Spatial join: cross-sections intersecting floodway
    joined = gpd.sjoin(xs_gdf, floodway, how="inner", predicate="intersects")
    # Deduplicate (a cross-section may intersect multiple polygons)
    id_col = 'Cross_Section_ID' if 'Cross_Section_ID' in joined.columns else joined.columns[0]
    filtered = joined.drop_duplicates(subset=[id_col])

    print(f"Filtered to {len(filtered)} cross-sections intersecting floodway "
          f"(from {len(xs_gdf)})")
    return filtered


def main():
    import argparse
    p = argparse.ArgumentParser(description="Process FEMA S_XS cross-section shapefile")
    p.add_argument("shapefile", help="Path to S_XS.shp")
    p.add_argument("--output", "-o", default=None, help="Output CSV path")
    p.add_argument("--head", type=int, default=10, help="Preview rows to print")
    p.add_argument("--floodway", default=None,
                   help="Path to S_Fld_Haz_Ar.shp for floodway-only filtering")
    p.add_argument("--zone-subtype", default="FLOODWAY",
                   help="ZONE_SUBTY value to match (default: FLOODWAY)")
    args = p.parse_args()

    try:
        result = process_fema_cross_sections(args.shapefile, args.output)

        if args.floodway:
            result = filter_to_floodway(result, args.floodway, args.zone_subtype)
            if args.output:
                # Re-export after filtering
                import pandas as pd
                pd.DataFrame(result.drop(columns='geometry')).to_csv(args.output, index=False)
                print(f"Re-exported filtered results to {args.output}")

        cols = [c for c in ['Letter_Marker', 'Waterway_Name', 'Stream_Station',
                            'Regulatory_WSEL'] if c in result.columns]
        print(f"\nPreview ({args.head} rows):")
        print(result[cols].head(args.head).to_string())
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
