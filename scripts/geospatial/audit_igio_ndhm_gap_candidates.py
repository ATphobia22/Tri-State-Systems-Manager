#!/usr/bin/env python3
"""Review-only nDHM pixels inside IGIO polygons for unresolved LiDAR height gaps.

Never emits source geometry, private attributes, raw raster data, or promotes a
raster-derived *candidate* to OBSERVED or DERIVED LiDAR height acceptance.
Only known 2020 IGIO normalized-height TIFFs with explicit ftUS band units are
considered. A quality candidate is not proof of a roof surface (trees remain).
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re

import numpy as np
import rasterio
from rasterio.mask import mask
from rasterio.errors import RasterioError
from shapely.geometry import shape, mapping, box
from shapely.strtree import STRtree
from shapely.ops import transform as shape_transform
from pyproj import CRS, Transformer

TILE_RE = re.compile(r'^IN2020_\d{8}_12_ndhm\.tif$')
FTUS_UNITS = frozenset(('US survey foot', 'US survey feet', 'ftUS'))
MAX_BUILDINGS = 25000
MAX_TILES = 1000
MAX_MATCHED_TILES = 8


def sha(path):
    h = hashlib.sha256()
    with open(path,'rb') as f:
        for part in iter(lambda:f.read(1<<20),b''):
            h.update(part)
    return h.hexdigest()


def feature_id(props):
    identifiers = [props[k] for k in ('igioObjectId','sourceObjectId','objectid','OBJECTID') if k in props and props[k] is not None]
    if not identifiers or any(type(x) is not int or x < 0 for x in identifiers) or len(set(identifiers)) != 1:
        raise ValueError('Missing/conflicting source OBJECTID')
    return identifiers[0]


def raster_horizontal_crs(ds):
    """Use only the horizontal component; never perform implicit vertical shift."""
    if ds.crs is None:
        return None
    crs = CRS.from_wkt(ds.crs.to_wkt())
    if crs.is_compound:
        components = crs.sub_crs_list
        if not components or not components[0].is_projected:
            return None
        return components[0]
    return crs if crs.is_projected else None


def index_rasters(rasters):
    """Build one bounded WGS84 index; never reopen every TIFF for every building.

    Native rasters may use a compound NAD83(HARN)/NAVD88 CRS for which EPSG
    identification is unavailable. Inspect its projected horizontal component,
    transform bounds with densification, and conservatively pad the envelope.
    The precise overlap/pixel mask is still evaluated against the native CRS.
    """
    envelopes, indexed_paths = [], []
    rejected = 0
    for path in rasters:
        try:
            with rasterio.open(path) as ds:
                horiz = raster_horizontal_crs(ds)
                if horiz is None or ds.count != 1 or ds.units[0] not in FTUS_UNITS:
                    rejected += 1
                    continue
                trans = Transformer.from_crs(horiz, 'EPSG:4326', always_xy=True)
                left, bottom, right, top = trans.transform_bounds(
                    ds.bounds.left, ds.bounds.bottom,
                    ds.bounds.right, ds.bounds.top, densify_pts=21
                )
                if not all(math.isfinite(x) for x in (left, bottom, right, top)):
                    rejected += 1
                    continue
                if not (-180 <= left < right <= 180 and -90 <= bottom < top <= 90):
                    rejected += 1
                    continue
                # Over-selection is safe; under-selection would lose evidence.
                # The 0.001-degree pad accommodates frame differences at edges.
                margin = 0.001
                envelopes.append(box(left-margin, bottom-margin,
                                     right+margin, top+margin))
                indexed_paths.append(path)
        except (ValueError, RasterioError, OSError):
            rejected += 1
    if not envelopes:
        raise ValueError('No nDHM tiles with valid horizontal CRS and unit metadata')
    return STRtree(envelopes), indexed_paths, rejected


def review_polygon(geom, rasters, tile_sha_cache=None):
    """Return pixel QA candidate *only*, without admitting a roof measurement."""
    if geom.is_empty or not geom.is_valid or geom.geom_type not in ('Polygon','MultiPolygon'):
        return {'reviewStatus':'INVALID_FOOTPRINT_TOPOLOGY'}
    pixels, tile_hashes, notices = [], [], set()
    if tile_sha_cache is None:
        tile_sha_cache = {}
    intersects = 0
    for path in rasters:
        try:
            with rasterio.open(path) as ds:
                horiz = raster_horizontal_crs(ds)
                if horiz is None or ds.count != 1 or ds.units[0] not in FTUS_UNITS:
                    notices.add('RASTER_CRS_OR_UNIT_UNVERIFIED')
                    continue
                fn = Transformer.from_crs('EPSG:4326', horiz, always_xy=True).transform
                g = shape_transform(fn, geom)
                if not all(math.isfinite(z) for z in g.bounds):
                    notices.add('COORDINATE_TRANSFORM_FAILED')
                    continue
                xmin,ymin,xmax,ymax=g.bounds
                b=ds.bounds
                if xmax <= b.left or xmin >= b.right or ymax <= b.bottom or ymin >= b.top:
                    continue
                intersects+=1
                if intersects > MAX_MATCHED_TILES:
                    return {'reviewStatus':'TOO_MANY_OVERLAPPING_SOURCE_TILES'}
                clipped,_=mask(ds, [mapping(g)], crop=True, filled=False, all_touched=False)
                values=np.ma.asarray(clipped[0]).compressed()
                values=values[np.isfinite(values)]
                if values.size:
                    pixels.extend(map(float,values))
                    cache_key = str(path)
                    if cache_key not in tile_sha_cache:
                        tile_sha_cache[cache_key] = sha(path)
                    tile_hashes.append({
                        'archiveTile': path.name,
                        'tileSha256': tile_sha_cache[cache_key],
                    })
        except (ValueError, RasterioError, OSError):
            notices.add('RASTER_READ_OR_COVERAGE_ERROR')
    if not pixels:
        return {'reviewStatus':'NO_USABLE_NDHM_PIXELS','notices':sorted(notices)}
    a=np.asarray(pixels,dtype=np.float64)
    median=float(np.median(a))
    p10,p25,p75,p90=np.percentile(a,[10,25,75,90])
    neg_frac=float(np.count_nonzero(a < 0)/a.size)
    stats={
        'pixelCount':int(a.size),
        'heightCandidateMedianFtUS':round(median,3),
        'p10FtUS':round(float(p10),3),
        'p90FtUS':round(float(p90),3),
        'iqrFtUS':round(float(p75-p25),3),
        'negativePixelFraction':round(neg_frac,5),
        'sourceTileDigests':tile_hashes,
        'notices':sorted(notices),
    }
    # Only a review candidate. Even smooth polygons could be tree canopy.
    qa=(a.size>=6 and 6.0<median<=100.0 and (p75-p25)<=8.0 and
        (p90-p10)<=16.0 and neg_frac<=0.02)
    stats['reviewStatus']='REVIEW_ROOF_VS_VEGETATION' if qa else 'NDHM_PIXEL_QA_UNSUITABLE'
    return stats


def audit(input_file, tile_dir, *, limit=None):
    raw=json.loads(Path(input_file).read_text(encoding='utf-8'))
    features=raw.get('features') if isinstance(raw,dict) else None
    if not isinstance(features,list) or not 0<len(features)<=MAX_BUILDINGS:
        raise ValueError('Expected bounded GeoJSON FeatureCollection')
    ids=set()
    gaps=[]
    for f in features:
        p=f.get('properties') if isinstance(f,dict) else None
        if not isinstance(p,dict):
            raise ValueError('Feature properties absent')
        oid=feature_id(p)
        if oid in ids:
            raise ValueError('Duplicate source OBJECTID')
        ids.add(oid)
        if p.get('lidarHeightStatus') != 'OK':
            gaps.append((oid,f.get('geometry')))
    rasters=sorted(p for p in Path(tile_dir).iterdir() if p.is_file() and TILE_RE.fullmatch(p.name))
    if not 0 < len(rasters) <= MAX_TILES:
        raise ValueError('No bounded verified 2020 nDHM tiles')
    if limit is not None and not 1<=limit<=MAX_BUILDINGS:
        raise ValueError('Invalid review limit')
    tree, indexed_paths, rejected_tiles = index_rasters(rasters)
    sha_cache = {}
    reviewed=[]
    for oid,g in sorted(gaps)[:limit]:
        try:
            if g is None:
                raise ValueError('Missing geometry')
            geom=shape(g)
            if geom.is_empty or not geom.is_valid or geom.geom_type not in ('Polygon','MultiPolygon'):
                rec={'reviewStatus':'INVALID_FOOTPRINT_TOPOLOGY'}
            else:
                candidate_paths = [indexed_paths[int(i)] for i in tree.query(geom)]
                rec=review_polygon(geom, candidate_paths, sha_cache)
        except (ValueError,TypeError):
            rec={'reviewStatus':'INVALID_FOOTPRINT_TOPOLOGY'}
        reviewed.append({'sourceObjectId':oid,**rec})
    statuses=dict(sorted(Counter(r['reviewStatus'] for r in reviewed).items()))
    return {
        'schemaVersion':'tsm.igio-ndhm-gap-candidates.v1',
        'classification':'PRIVATE_REVIEW_ONLY',
        'heightProvenance':'NOT_ACCEPTED',
        'geometryPublished':False,
        'rasterPixelsPublished':False,
        'noAutomaticHeightPromotion':True,
        'engineeringUse':False,
        'regulatoryUse':False,
        'acceptedRoofHeightCount':0,
        'sourceGeojsonSha256':sha(input_file),
        'inputFeatureCount':len(features),
        'missingLiDARHeightCount':len(gaps),
        'reviewedCount':len(reviewed),
        'reviewTruncated':len(reviewed)<len(gaps),
        'rasterInputCount':len(rasters),
        'rasterIndexedCount':len(indexed_paths),
        'rasterMetadataRejectedCount':rejected_tiles,
        'rasterInputStatus':'PARTIAL_SOURCE_METADATA' if rejected_tiles else 'ALL_INDEXED',
        'uniqueRasterDigestsComputed':len(sha_cache),
        'reasonCounts':statuses,
        'reviewRows':reviewed,
        'caveat':'Relative nDHM is not uniquely roof elevation: trees, nodata, footprint mismatch, acquisition vintage and geometric uncertainty require validation against point-cloud roof evidence. No accepted heights or meshes are emitted.',
    }


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--geojson',type=Path,required=True)
    ap.add_argument('--ndhm-tile-dir',type=Path,required=True)
    ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--limit-buildings',type=int)
    args=ap.parse_args()
    if args.out.exists() or args.out.resolve()==args.geojson.resolve():
        ap.error('Do not overwrite existing evidence or sources')
    d=audit(args.geojson,args.ndhm_tile_dir,limit=args.limit_buildings)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(d,sort_keys=True,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'totalGaps':d['missingLiDARHeightCount'],'reviewed':d['reviewedCount'], 'reasonCounts':d['reasonCounts']},sort_keys=True))


if __name__=='__main__':
    main()