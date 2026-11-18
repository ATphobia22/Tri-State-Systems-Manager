import csv
import json
import subprocess
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box

SCRIPT = Path(__file__).resolve().parents[2] / 'tools/geospatial_exchange/posey_panel_loma_prescreen.py'
PANEL = '18129C0300C'
CRS = 'EPSG:32616'


def fixtures(tmp_path, *, bfe='390', dem_value=120.0, duplicate_parcel=False, datum='NAVD88'):
    def save(name, geoms, ids):
        path = tmp_path / (name + '.geojson')
        gpd.GeoDataFrame(ids, geometry=geoms, crs=CRS).to_file(path, driver='GeoJSON')
        return path
    parcels = save('parcels', [box(3, 3, 17, 17)] + ([box(3, 3, 17, 17)] if duplicate_parcel else []),
                   {'parcel_id': ['P01'] + (['P02'] if duplicate_parcel else [])})
    buildings = save('buildings', [box(7, 7, 11, 11), box(30, 30, 32, 32)], {'building_id': ['B01', 'B02']})
    zones = save('zones', [box(0, 0, 19, 19)], {'FLD_ZONE': ['AE'], 'SFHA_TF': ['T'], 'DFIRM_ID': ['18129C']})
    panels = save('panels', [box(0, 0, 20, 20)], {'FIRM_PAN': [PANEL], 'DFIRM_ID': ['18129C']})
    raster = tmp_path / 'dem.tif'
    with rasterio.open(raster, 'w', driver='GTiff', height=40, width=40, count=1, dtype='float32',
                       transform=from_origin(0, 40, 1, 1), crs=CRS, nodata=-9999) as ds:
        ds.write(np.full((40, 40), dem_value, dtype='float32'), 1)
    bfe_csv = tmp_path / 'bfe.csv'
    with bfe_csv.open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['building_id', 'bfe_navd88_ft', 'bfe_source', 'bfe_datum', 'reviewed'])
        writer.writeheader()
        if bfe is not None:
            writer.writerow({'building_id': 'B01', 'bfe_navd88_ft': bfe, 'bfe_source': 'FIS_PROFILE_REVIEWED', 'bfe_datum': 'NAVD88', 'reviewed': 'true'})
    return [str(p) for p in (parcels, buildings, zones, panels, raster, bfe_csv)], datum


def run(tmp_path, *args, extra=()):
    parcels, buildings, zones, panels, dem, bfe = args
    output = tmp_path / 'out.csv'; receipt = tmp_path / 'receipt.json'
    result = subprocess.run([sys.executable, str(SCRIPT), '--parcels', parcels, '--buildings', buildings,
                             '--sfha', zones, '--panels', panels, '--dem', dem, '--bfe', bfe,
                             '--dem-vertical-datum', 'NAVD88', '--dem-unit', 'metre',
                             '--panel-id', PANEL, '--output', str(output), '--receipt', str(receipt), *extra],
                            capture_output=True, text=True)
    return result, list(csv.DictReader(output.open())) if output.exists() else [], json.loads(receipt.read_text()) if receipt.exists() else None


def test_above_bfe_is_only_screening_and_offpanel_excluded(tmp_path):
    args, _ = fixtures(tmp_path)
    result, rows, receipt = run(tmp_path, *args)
    assert result.returncode == 0, result.stderr
    assert len(rows) == 1
    assert rows[0]['building_id'] == 'B01'
    assert rows[0]['status'] == 'DEM_ABOVE_BFE_REVIEW_SURVEY'
    assert rows[0]['official_loma_eligible'] == 'false'
    assert float(rows[0]['dem_adjacent_min_navd88_ft']) > float(rows[0]['bfe_navd88_ft'])
    assert receipt['screening_only'] is True and receipt['official_loma_eligible_count'] == 0
    assert len(receipt['sha256_inputs']) == 6


def test_missing_bfe_never_infers_eligibility(tmp_path):
    args, _ = fixtures(tmp_path, bfe=None)
    result, rows, _ = run(tmp_path, *args)
    assert result.returncode == 0, result.stderr
    assert rows[0]['status'] == 'INSUFFICIENT_BFE_EVIDENCE'
    assert rows[0]['freeboard_dem_minus_bfe_ft'] == ''


def test_negative_margin_not_rejection(tmp_path):
    args, _ = fixtures(tmp_path, bfe='400')
    result, rows, _ = run(tmp_path, *args)
    assert result.returncode == 0, result.stderr
    assert rows[0]['status'] == 'DEM_BELOW_BFE_REVIEW'
    assert float(rows[0]['freeboard_dem_minus_bfe_ft']) < 0


def test_ambiguous_parcel_join_never_picks_first(tmp_path):
    args, _ = fixtures(tmp_path, duplicate_parcel=True)
    result, rows, _ = run(tmp_path, *args)
    assert result.returncode == 0, result.stderr
    assert rows[0]['parcel_id'] == ''
    assert rows[0]['parcel_match'] == 'AMBIGUOUS'
    assert rows[0]['status'] == 'AMBIGUOUS_PARCEL_JOIN'


def test_dem_datum_must_be_declared_navd88(tmp_path):
    args, _ = fixtures(tmp_path)
    result, rows, _ = run(tmp_path, *args, extra=['--dem-vertical-datum', 'EGM2008'])
    assert result.returncode != 0
    assert not rows
    assert 'NAVD88' in result.stderr


def test_nodata_dem_never_becomes_zero(tmp_path):
    args, _ = fixtures(tmp_path, dem_value=-9999)
    result, rows, _ = run(tmp_path, *args)
    assert result.returncode == 0, result.stderr
    assert rows[0]['status'] == 'INSUFFICIENT_DEM_EVIDENCE'
    assert rows[0]['dem_adjacent_min_navd88_ft'] == ''

def test_building_zone_only_outside_firm_panel_is_excluded(tmp_path):
    args, _ = fixtures(tmp_path)
    parcels, buildings, zones, panels, *_ = args
    b = gpd.read_file(buildings)
    b.loc[0, 'geometry'] = box(18, 7, 22, 11)
    b.to_file(buildings, driver='GeoJSON')
    p = gpd.read_file(parcels)
    p.loc[0, 'geometry'] = box(17, 3, 25, 17)
    p.to_file(parcels, driver='GeoJSON')
    z = gpd.read_file(zones)
    z.loc[0, 'geometry'] = box(20.1, 0, 30, 20)
    z.to_file(zones, driver='GeoJSON')
    result, rows, _ = run(tmp_path, *args)
    assert result.returncode == 0, result.stderr
    assert rows == [], 'Zone AE outside the selected FIRM panel cannot create a candidate'


def test_missing_parcel_identity_rejected(tmp_path):
    args, _ = fixtures(tmp_path)
    parcels = args[0]
    p = gpd.read_file(parcels)
    p.loc[0, 'parcel_id'] = ''
    p.to_file(parcels, driver='GeoJSON')
    result, rows, _ = run(tmp_path, *args)
    assert result.returncode != 0
    assert not rows
    assert 'parcel' in result.stderr.lower()


def test_coarse_30m_dem_not_accepted_as_structure_grade(tmp_path):
    args, _ = fixtures(tmp_path)
    dem = args[4]
    with rasterio.open(dem, 'w', driver='GTiff', height=2, width=2, count=1,
                       dtype='float32', transform=from_origin(0, 40, 30, 30),
                       crs=CRS, nodata=-9999) as ds:
        ds.write(np.full((2, 2), 120.0, dtype='float32'), 1)
    result, rows, _ = run(tmp_path, *args)
    assert result.returncode != 0
    assert not rows
    assert 'resolution' in result.stderr.lower()


def test_partial_dem_tile_does_not_claim_above_bfe(tmp_path):
    """A one-sided DEM tile may be higher than BFE but cannot establish an adjacent minimum."""
    args, _ = fixtures(tmp_path)
    dem = args[4]
    # Bounds x=0..9 cover only part of the exterior ring of building x=7..11.
    with rasterio.open(dem, 'w', driver='GTiff', height=20, width=9, count=1,
                       dtype='float32', transform=from_origin(0, 20, 1, 1),
                       crs=CRS, nodata=-9999) as ds:
        ds.write(np.full((20, 9), 120.0, dtype='float32'), 1)
    result, rows, _ = run(tmp_path, *args)
    assert result.returncode == 0, result.stderr
    assert rows[0]['status'] == 'INSUFFICIENT_DEM_EVIDENCE'
    assert rows[0]['dem_adjacent_min_navd88_ft'] == ''


def test_nodata_majority_of_adjacent_ring_does_not_claim_above_bfe(tmp_path):
    """Do not pass an incomplete building perimeter just because a few valid cells survive."""
    args, _ = fixtures(tmp_path)
    with rasterio.open(args[4], 'r+') as ds:
        arr = ds.read(1)
        # Mask western half of the building's surrounding 1-meter ring.
        arr[:, :9] = -9999
        ds.write(arr, 1)
    result, rows, _ = run(tmp_path, *args)
    assert result.returncode == 0, result.stderr
    assert rows[0]['status'] == 'INSUFFICIENT_DEM_EVIDENCE'
    assert rows[0]['dem_adjacent_min_navd88_ft'] == ''
