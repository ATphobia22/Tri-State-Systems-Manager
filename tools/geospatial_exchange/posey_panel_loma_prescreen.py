#!/usr/bin/env python3
"""Offline, FEMA-effective *screening* of structures in one FIRM panel.

Inputs are operator-supplied GeoJSON/GeoPackage vectors and one local DEM GeoTIFF.
A minimum of DEM cells in a ground-side ring is a *proxy*, never certified LAG.
An explicitly reviewed site BFE is required before a diagnostic margin is output.
Nothing in this tool issues, predicts, or proves FEMA LOMA eligibility.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from pyproj import CRS
from rasterio.errors import WindowError
from rasterio.features import geometry_mask
from rasterio.mask import mask
from shapely.geometry import Polygon, mapping

OUTPUT_FIELDS = [
    'building_id', 'parcel_id', 'parcel_match', 'panel_id', 'flood_zone',
    'dem_adjacent_min_navd88_ft', 'bfe_navd88_ft',
    'freeboard_dem_minus_bfe_ft', 'sampled_dem_cells', 'status',
    'official_loma_eligible',
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def vector(path: Path, required: list[str], crs: CRS) -> gpd.GeoDataFrame:
    data = gpd.read_file(path)
    if data.crs is None:
        raise ValueError(f'{path}: source CRS is missing')
    missing = set(required) - set(data.columns)
    if missing:
        raise ValueError(f'{path}: missing required fields {sorted(missing)}')
    if any(g is None or g.is_empty or not g.is_valid or g.geom_type not in ('Polygon', 'MultiPolygon')
           for g in data.geometry):
        raise ValueError(f'{path}: invalid or non-polygon geometry; repair with separate evidence')
    return data.to_crs(crs)


def reviewed_bfes(path: Path) -> dict[str, float]:
    found: dict[str, float] = {}
    with path.open(newline='', encoding='utf-8-sig') as handle:
        reader = csv.DictReader(handle)
        fields = {'building_id', 'bfe_navd88_ft', 'bfe_source', 'bfe_datum', 'reviewed'}
        if not fields.issubset(reader.fieldnames or []):
            raise ValueError('BFE CSV must include building_id,bfe_navd88_ft,bfe_source,bfe_datum,reviewed')
        seen: set[str] = set()
        for row in reader:
            identifier = (row['building_id'] or '').strip()
            if not identifier or identifier in seen:
                raise ValueError('Duplicate or missing BFE building identifier')
            seen.add(identifier)
            try:
                value = float(row['bfe_navd88_ft'])
            except (ValueError, TypeError):
                continue
            if (row['bfe_datum'] or '').strip().upper() != 'NAVD88' or \
               (row['reviewed'] or '').strip().lower() != 'true' or \
               not (row['bfe_source'] or '').strip() or not math.isfinite(value) or \
               value in (-999, -9999, -8888):
                continue
            found[identifier] = value
    return found


def sample_adjacent_min_ft(dem: rasterio.io.DatasetReader, building,
                           width_in_crs_units: float, metres_per_vertical_unit: float):
    # Sample a narrow exterior band, not a filled building footprint or rooftop.
    exterior = building.buffer(width_in_crs_units).difference(building)
    if exterior.is_empty or exterior.area <= 0:
        return None, 0

    # A truncated DEM cannot establish a minimum adjacent grade. Use the
    # transformed raster-corner quadrilateral, not just its bounding box;
    # this also handles projected rasters with rotation or shear.
    corners = [dem.transform * (col, row) for col, row in (
        (0, 0), (dem.width, 0), (dem.width, dem.height), (0, dem.height),
    )]
    raster_footprint = Polygon(corners)
    if (not raster_footprint.is_valid or
            exterior.difference(raster_footprint).area > exterior.area * 0.01):
        return None, 0

    try:
        array, clipped_transform = mask(
            dem, [mapping(exterior)], crop=True, filled=False,
            indexes=1, all_touched=False,
        )
    except (ValueError, WindowError):
        return None, 0

    # Rasterio's masked output does not distinguish cells outside the ring
    # from nodata cells inside it. Measure the selected ring explicitly.
    ring_mask = geometry_mask(
        [mapping(exterior)], out_shape=array.shape,
        transform=clipped_transform, invert=True, all_touched=False,
    )
    ring_count = int(np.count_nonzero(ring_mask))
    if ring_count == 0:
        return None, 0
    data = np.asarray(np.ma.getdata(array), dtype=np.float64)
    usable = (ring_mask & ~np.ma.getmaskarray(array) &
              np.isfinite(data) & ~np.isin(data, [-999, -9999, -8888]))
    valid_count = int(np.count_nonzero(usable))
    # Never elevate a partial peripheral measurement to a positive review
    # result; this is a data-completeness gate, not survey-grade assurance.
    if valid_count / ring_count < 0.80:
        return None, valid_count
    return float(data[usable].min() * metres_per_vertical_unit / 0.3048), valid_count


def screen(args) -> tuple[list[dict], dict]:
    if args.dem_vertical_datum != 'NAVD88':
        raise ValueError('DEM vertical datum must be explicitly sourced as NAVD88; no geoid assumption')
    if args.ring_width_m <= 0 or not math.isfinite(args.ring_width_m):
        raise ValueError('Ring width must be positive')
    if not args.panel_id.startswith('18129C') or len(args.panel_id) != 11:
        raise ValueError('Expected an 11-character Posey County FIRM panel ID')
    paths = {key: Path(getattr(args, key)) for key in ('parcels', 'buildings', 'sfha', 'panels', 'dem', 'bfe')}
    with rasterio.open(paths['dem']) as dem:
        if dem.count != 1 or dem.crs is None:
            raise ValueError('Single-band georeferenced DEM required')
        crs = CRS.from_user_input(dem.crs)
        if not crs.is_projected:
            raise ValueError('A projected DEM CRS is required for metric ground-side sampling')
        axis = crs.axis_info[0]
        if axis.unit_conversion_factor is None:
            raise ValueError('DEM projected CRS has no established horizontal units')
        grid_x_m = math.hypot(dem.transform.a, dem.transform.d) * axis.unit_conversion_factor
        grid_y_m = math.hypot(dem.transform.b, dem.transform.e) * axis.unit_conversion_factor
        if not (0 < grid_x_m <= 2.0 and 0 < grid_y_m <= 2.0):
            raise ValueError('DEM raster resolution exceeds 2 meters; cannot pre-screen structures')
        width = args.ring_width_m / axis.unit_conversion_factor
        v_m = {'metre': 1.0, 'us_survey_foot': 1200 / 3937, 'international_foot': 0.3048}[args.dem_unit]
        parcels = vector(paths['parcels'], ['parcel_id'], crs)
        buildings = vector(paths['buildings'], ['building_id'], crs)
        if any(not isinstance(pid, str) or not pid.strip() for pid in parcels['parcel_id']):
            raise ValueError('Parcel source contains blank or invalid parcel identity')
        sfha = vector(paths['sfha'], ['DFIRM_ID', 'FLD_ZONE', 'SFHA_TF'], crs)
        panels = vector(paths['panels'], ['DFIRM_ID', 'FIRM_PAN'], crs)
        panel = panels[(panels['FIRM_PAN'] == args.panel_id) & (panels['DFIRM_ID'] == '18129C')]
        if len(panel) != 1:
            raise ValueError('Exactly one matching, authoritative FIRM panel geometry required')
        zones = sfha[(sfha['DFIRM_ID'] == '18129C') & (sfha['SFHA_TF'] == 'T') & (sfha['FLD_ZONE'] == 'AE')]
        if zones.empty:
            raise ValueError('No Posey effective FEMA Zone AE/SFHA geometry in the supplied source')
        if buildings['building_id'].isna().any() or buildings['building_id'].duplicated().any():
            raise ValueError('Building identifiers must be unique and non-null')
        bfes = reviewed_bfes(paths['bfe'])
        parcel_index = parcels.sindex
        zone_index = zones.sindex
        rows: list[dict] = []
        for building in buildings.itertuples(index=False):
            geom = building.geometry
            within_panel = geom.intersection(panel.geometry.iloc[0])
            if within_panel.area <= 0:
                continue
            if not any(within_panel.intersection(zones.geometry.iloc[i]).area > 0
                       for i in zone_index.query(within_panel, predicate='intersects')):
                continue
            match_indices = [i for i in parcel_index.query(geom, predicate='intersects')
                             if parcels.geometry.iloc[i].intersection(geom).area > 0]
            matches = parcels.iloc[match_indices]
            parcel_match = 'UNIQUE' if len(matches) == 1 else ('AMBIGUOUS' if len(matches) > 1 else 'NO_MATCH')
            parcel_id = str(matches['parcel_id'].iloc[0]) if parcel_match == 'UNIQUE' else ''
            minimum, cells = sample_adjacent_min_ft(dem, geom, width, v_m)
            bfe = bfes.get(str(building.building_id))
            margin = minimum - bfe if minimum is not None and bfe is not None else None
            if parcel_match != 'UNIQUE':
                status = 'AMBIGUOUS_PARCEL_JOIN' if parcel_match == 'AMBIGUOUS' else 'MISSING_PARCEL_JOIN'
            elif minimum is None:
                status = 'INSUFFICIENT_DEM_EVIDENCE'
            elif bfe is None:
                status = 'INSUFFICIENT_BFE_EVIDENCE'
            else:
                status = 'DEM_ABOVE_BFE_REVIEW_SURVEY' if margin >= 0 else 'DEM_BELOW_BFE_REVIEW'
            rows.append({
                'building_id': str(building.building_id), 'parcel_id': parcel_id,
                'parcel_match': parcel_match, 'panel_id': args.panel_id, 'flood_zone': 'AE',
                'dem_adjacent_min_navd88_ft': f'{minimum:.3f}' if minimum is not None else '',
                'bfe_navd88_ft': f'{bfe:.3f}' if bfe is not None else '',
                'freeboard_dem_minus_bfe_ft': f'{margin:.3f}' if margin is not None else '',
                'sampled_dem_cells': cells, 'status': status, 'official_loma_eligible': 'NOT_DETERMINED',
            })
        receipt = {
            'authority': 'FEMA NFHL source snapshot as supplied, not independently revalidated',
            'panel_id': args.panel_id, 'screening_only': True,
            'official_loma_eligible_count': None, 'candidate_structures': None,
            'screened_structure_rows': len(rows),
            'count_state': 'UNKNOWN_MISSING_EVIDENCE_NOT_ZERO',
            'run_generated_at_utc': datetime.now(timezone.utc).isoformat(),
            'source_vintage_independently_verified': False,
            'sha256_inputs': {key: sha256(path) for key, path in paths.items()},
            'raster_crs': crs.to_string(), 'dem_vertical_datum_asserted': args.dem_vertical_datum,
            'dem_vertical_unit': args.dem_unit, 'adjacent_buffer_width_m': args.ring_width_m,
            'sampling': 'minimum valid cell in exterior ring; 99% raster extent and >=80% valid ring-cell coverage required; DEM proxy only, not certified LAG',
            'limitations': 'No FEMA determination, surveyed LAG/LLE, no fill history, no BFE interpolation, no legal parcel LOMA eligibility',
        }
    return rows, receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('parcels', 'buildings', 'sfha', 'panels', 'dem', 'bfe', 'output', 'receipt'):
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--panel-id', default='18129C0300C')
    parser.add_argument('--dem-vertical-datum', required=True)
    parser.add_argument('--dem-unit', choices=['metre', 'us_survey_foot', 'international_foot'], required=True)
    parser.add_argument('--ring-width-m', type=float, default=1.0)
    args = parser.parse_args()
    rows, receipt = screen(args)
    output = Path(args.output)
    with output.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS)
        writer.writeheader(); writer.writerows(rows)
    Path(args.receipt).write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()