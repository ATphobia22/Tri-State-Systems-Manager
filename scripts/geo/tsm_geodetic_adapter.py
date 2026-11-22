#!/usr/bin/env python3
"""TSM Geodetic Evidence Router: an offline, headless, fail-safe GIS adapter.

Never infer missing source datum or elevate numerical reversibility to survey
control validation. Original files are read only; corrections are append-only.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import math
import os
from pathlib import Path
import shutil
import sqlite3
import sys
import zipfile

from pyproj import CRS, Transformer, datadir, proj_version_str
from pyproj.transformer import TransformerGroup

GRID_NAME = 'us_noaa_nadcon5_nad27_nad83_1986_conus.tif'
GRID_URL = 'https://cdn.proj.org/' + GRID_NAME
GRIDS_ALLOWED_HOST = 'cdn.proj.org'
COUNTY_FIPS = {'Gibson': '18051', 'Posey': '18129', 'Vanderburgh': '18163', 'Warrick': '18173'}

class GateError(RuntimeError):
    """Evidence gate is not satisfied; no approved engineering result exists."""


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()


def choose_transformer(src_epsg: int | None, dst_epsg: int = 2966) -> Transformer:
    if src_epsg is None:
        raise GateError('UNKNOWN_SOURCE_CRS: a .prj or approved published source CRS is mandatory')
    src = CRS.from_epsg(int(src_epsg))
    dst = CRS.from_epsg(int(dst_epsg))
    if not src.is_projected or not dst.is_projected or src.is_vertical or dst.is_vertical:
        raise GateError('INVALID_HORIZONTAL_CRS: expected explicit projected horizontal CRS')
    if src == dst:
        return Transformer.from_pipeline('+proj=noop')
    try:
        grp = TransformerGroup(src, dst, always_xy=True, allow_ballpark=False)
    except Exception as e:
        raise GateError('TRANSFORMATION_UNAVAILABLE: ' + str(e)) from e
    if not grp.best_available or not grp.transformers:
        missing = ', '.join(sorted({g.short_name for o in grp.unavailable_operations
                                    for g in o.grids if not g.available}))
        raise GateError('TRANSFORMATION_UNAVAILABLE: missing grids: ' + (missing or 'unspecified'))
    op = grp.transformers[0]
    if op.accuracy < 0:
        raise GateError('UNKNOWN_OPERATION_ACCURACY: cannot certify operation')
    return op


def verify_grid(path: Path, *, expected_sha256: str | None = None) -> dict:
    path = Path(path)
    if not path.is_file() or path.stat().st_size < 1024:
        raise GateError('INVALID_GRID_FILE: missing or implausibly small')
    actual = sha256_file(path)
    if expected_sha256 and actual.lower() != expected_sha256.lower():
        raise GateError('GRID_SHA256_MISMATCH')
    try:
        import rasterio
        with rasterio.open(path) as ds:
            if ds.count < 2 or ds.width < 10 or ds.height < 10:
                raise GateError('GRID_NOT_NADCON5_STYLE: invalid grid bands or shape')
            description = list(ds.descriptions)
            driver = ds.driver
    except GateError:
        raise
    except Exception as exc:
        raise GateError('UNREADABLE_GRID: ' + str(exc)) from exc
    return {'path': str(path), 'sha256': actual, 'size': path.stat().st_size,
            'driver': driver, 'bands': description,
            'identity_verified': bool(expected_sha256),
            'official_download_url': GRID_URL,
            'operation_available': False,
            'note': 'Format check only; installed-grid operation selection and independent controls remain required'}



def fetch_official_grid(output:Path, *, expected_sha256: str | None = None) -> dict:
    """Explicit network acquisition; only official PROJ HTTPS grid endpoint allowed.

    Download is NOT authorization to use the grid for scientific computations.
    Verification requires a trusted hash and independent surveyed controls.
    """
    import urllib.request
    output = Path(output)
    if output.name != GRID_NAME:
        raise GateError('GRID_FILENAME_MISMATCH')
    if output.exists():
        raise GateError('GRID_ALREADY_EXISTS: never overwrite an existing grid')
    output.parent.mkdir(parents=True,exist_ok=True)
    candidate = output.with_suffix(output.suffix + '.incomplete')
    if candidate.exists():
        raise GateError('INCOMPLETE_DOWNLOAD_ALREADY_EXISTS')
    request = urllib.request.Request(GRID_URL,headers={'User-Agent':'TSM-geodetic-adapter/1'})
    try:
        with urllib.request.urlopen(request,timeout=25) as response, candidate.open('xb') as file:
            if response.geturl() != GRID_URL:
                raise GateError('GRID_REDIRECT_REJECTED')
            count=0
            while True:
                part=response.read(1024*1024)
                if not part: break
                count+=len(part)
                if count > 80*1024*1024:
                    raise GateError('GRID_DOWNLOAD_TOO_LARGE')
                file.write(part)
            file.flush();os.fsync(file.fileno())
        info = verify_grid(candidate,expected_sha256=expected_sha256)
        os.replace(candidate, output)
        info['path'] = str(output)
        info['acquisition_source'] = GRID_URL
        info['scientific_validation'] = False
        return info
    except Exception:
        candidate.unlink(missing_ok=True)
        raise

def install_grid(path: Path, directory: Path, *, expected_sha256: str) -> dict:
    """Install locally after explicit SHA pinning. Does not assert survey accuracy."""
    result = verify_grid(path, expected_sha256=expected_sha256)
    if Path(path).name != GRID_NAME:
        raise GateError('GRID_FILENAME_MISMATCH')
    directory = Path(directory).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    dest = directory / GRID_NAME
    if dest.exists() and sha256_file(dest) != expected_sha256.lower():
        raise GateError('EXISTING_GRID_CONFLICT')
    shutil.copyfile(path, dest)
    if sha256_file(dest) != expected_sha256.lower():
        raise GateError('COPIED_GRID_CORRUPTED')
    datadir.append_data_dir(str(directory))
    result['installed_path'] = str(dest)
    result['operation_available'] = choose_transformer(26716, 2966) is not None
    return result


def control_residuals(transformer: Transformer, controls: list[dict], max_rmse_m: float) -> dict:
    """Require real independently surveyed matched-source and target coordinates.

    A control point must have an externally verified NGS mark PID/source URL;
    do not accept computed reverse coordinates or county polygon centroids.
    """
    if not (max_rmse_m > 0 and math.isfinite(max_rmse_m)):
        raise GateError('INVALID_CONTROL_THRESHOLD')
    if len(controls) < 3:
        raise GateError('INSUFFICIENT_INDEPENDENT_CONTROLS: at least three required')
    rows = []
    for p in controls:
        name = str(p.get('id', ''))
        source = str(p.get('source_url', ''))
        pid = str(p.get('ngs_pid', ''))
        if not (len(pid) == 6 and pid[:2].isalpha() and pid[2:].isdigit()
                and source.startswith(('https://geodesy.noaa.gov/', 'https://www.ngs.noaa.gov/', 'https://www.geodesy.noaa.gov/'))
                and p.get('independent_observation') is True
                and p.get('source_frame') and p.get('target_frame')
                and p.get('source_epoch') and p.get('target_epoch')):
            raise GateError('CONTROL_NOT_INDEPENDENT: NGS PID, official URL, frames, epochs, independent observation required for ' + name)
        xs, ys, xt, yt = (float(p[k]) for k in ('source_x','source_y','target_x','target_y'))
        if not all(map(math.isfinite,(xs,ys,xt,yt))):
            raise GateError('NONFINITE_CONTROL')
        x,y = transformer.transform(xs,ys,errcheck=True)
        # Target is EPSG:2966, whose linear unit is US survey foot.
        scale = CRS.from_epsg(2966).axis_info[0].unit_conversion_factor
        ex,ey = (x-xt)*scale,(y-yt)*scale
        rows.append({'id':name,'ngs_pid':pid,'delta_east_m':ex,'delta_north_m':ey,'horizontal_error_m':math.hypot(ex,ey), 'source_url':source})
    if len({r['ngs_pid'] for r in rows}) != len(rows):
        raise GateError('DUPLICATED_CONTROL_POINTS')
    rmse = math.sqrt(sum(r['horizontal_error_m']**2 for r in rows)/len(rows))
    return {'controls_count':len(rows), 'rmse_horizontal_m':rmse,
            'maximum_horizontal_m':max(r['horizontal_error_m'] for r in rows),
            'threshold_m':max_rmse_m, 'within_threshold': rmse <= max_rmse_m,
            'mark_residuals': rows, 'geometry_control_type': 'independently_surveyed_NGS_matched_pairs'}


def _walk_coordinates(coordinates, op):
    if not isinstance(coordinates, (list, tuple)) or not coordinates:
        raise GateError('INVALID_COORDINATES')
    if isinstance(coordinates[0], (int,float)):
        if len(coordinates) != 2:
            raise GateError('UNVERIFIED_VERTICAL_COORDINATE: only 2D XY are allowed')
        x,y = (float(v) for v in coordinates)
        if not all(map(math.isfinite,(x,y))):
            raise GateError('NONFINITE_COORDINATES')
        x,y = op.transform(x,y,errcheck=True)
        return [x,y]
    return [_walk_coordinates(c, op) for c in coordinates]


def _map_geometry(g, op):
    if g is None: return None
    tp = g['type']
    if tp == 'GeometryCollection':
        return {'type':tp, 'geometries': [_map_geometry(x,op) for x in g.get('geometries',[])]}
    if tp not in {'Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon'}:
        raise GateError('UNSUPPORTED_GEOMETRY_TYPE: '+str(tp))
    return {'type':tp,'coordinates':_walk_coordinates(g['coordinates'],op)}


def derive_derived_geojson(document:dict, src:int|None, dst:int=2966) -> dict:
    if document.get('type') != 'FeatureCollection':
        raise GateError('EXPECTED_GEOJSON_FEATURE_COLLECTION')
    op = choose_transformer(src,dst)
    features=[]
    for f in document['features']:
        if f.get('type') != 'Feature': raise GateError('INVALID_FEATURE')
        features.append({'type':'Feature','id':f.get('id'),
          'properties':dict(f.get('properties') or {}),'geometry':_map_geometry(f.get('geometry'),op)})
    return {'type':'FeatureCollection','features':features,
       'tsm_evidence':{'source_epsg':src,'target_epsg':dst,
       'vertical_datum':'UNVERIFIED','vertical_units':'UNVERIFIED',
       'independent_survey_controls_verified':False,
       'properties_not_vertically_reprojected':True,
       'engineering_approved':False}}


def route_evidence(record:dict, destination:str)->str:
    if destination not in {'engineering','visualization','review'}:
        raise GateError('DESTINATION_NOT_ALLOWED')
    if destination == 'review': return 'REVIEW_QUEUE'
    if record.get('source_crs') not in (26916,26716,2966) or record.get('coordinate_transformation_available') is False:
        return 'QUARANTINE'
    try:
        choose_transformer(record['source_crs'], 2966)
    except (GateError, ValueError):
        return 'QUARANTINE'
    if destination == 'visualization': return 'VISUALIZATION_WITH_WARNING'
    required = (record.get('vertical_datum') == 'NAVD88',
                record.get('vertical_units') in {'metre','US survey foot'},
                record.get('control_validation') == 'INDEPENDENT_PASS',
                record.get('human_approval') is True,
                record.get('licensing_review') == 'APPROVED',
                record.get('source_integrity') == 'PASS')
    return 'ENGINEERING_REVIEW_READY' if all(required) else 'QUARANTINE'



def propagate_covariance(src_epsg:int,dst_epsg:int,x:float,y:float,
                         sigma_x_m:float,sigma_y_m:float, covariance_xy_m2:float=0.0)->dict:
    """First-order uncertainty propagation J Sigma J^T, reported in metres.

    Does not add systematic frame/grid uncertainty or establish survey accuracy.
    """
    if not all(math.isfinite(v) for v in (x,y,sigma_x_m,sigma_y_m,covariance_xy_m2)):
        raise GateError('NONFINITE_COVARIANCE_INPUT')
    if sigma_x_m<=0 or sigma_y_m<=0 or abs(covariance_xy_m2)>sigma_x_m*sigma_y_m:
        raise GateError('INVALID_COVARIANCE_MATRIX')
    src=CRS.from_epsg(src_epsg);dst=CRS.from_epsg(dst_epsg)
    sf=src.axis_info[0].unit_conversion_factor
    df=dst.axis_info[0].unit_conversion_factor
    op=choose_transformer(src_epsg,dst_epsg)
    h=0.1/sf
    xy=[]
    for dx,dy in ((h,0),(-h,0),(0,h),(0,-h)):
        a,b=op.transform(x+dx,y+dy,errcheck=True)
        xy.append((a*df,b*df))
    a=(xy[0][0]-xy[1][0])/(2*.1)
    b=(xy[2][0]-xy[3][0])/(2*.1)
    c=(xy[0][1]-xy[1][1])/(2*.1)
    d=(xy[2][1]-xy[3][1])/(2*.1)
    sxx,sxy,syy=sigma_x_m**2,covariance_xy_m2,sigma_y_m**2
    vx=a*a*sxx+2*a*b*sxy+b*b*syy
    vy=c*c*sxx+2*c*d*sxy+d*d*syy
    cov=a*c*sxx+(a*d+b*c)*sxy+b*d*syy
    return {'source_epsg':src_epsg,'target_epsg':dst_epsg,
       'sigma_east_m':math.sqrt(max(0,vx)),'sigma_north_m':math.sqrt(max(0,vy)),
       'covariance_east_north_m2':cov,'jacobian':[[a,b],[c,d]],
       'method':'finite_difference_J_Sigma_JT','grid_or_datum_accuracy_included':False,
       'independent_control_verified':False,'engineering_approved':False}


def hydraulic_gradient(first:dict, second:dict, distance_m:float)->dict:
    """Hydraulic head gradient for explicitly verified *same vertical datum*.

    Use only comparable point-head measurements, not unverified contour labels.
    """
    if (first.get('vertical_datum')!='NAVD88' or
        second.get('vertical_datum')!='NAVD88' or
        first.get('approved') is not True or second.get('approved') is not True):
        raise GateError('UNVERIFIED_VERTICAL_DATUM_OR_EVIDENCE')
    units={'metre':1.0,'US survey foot':1200/3937,'international foot':0.3048}
    u1,u2=first.get('units'),second.get('units')
    if u1 not in units or u2 not in units:
        raise GateError('UNKNOWN_VERTICAL_UNITS')
    h1,h2=float(first['h'])*units[u1],float(second['h'])*units[u2]
    distance_m=float(distance_m)
    if distance_m<=0 or not all(map(math.isfinite,(distance_m,h1,h2))):
        raise GateError('INVALID_DISTANCE_OR_HEAD')
    return {'rise_m':h2-h1,'distance_m':distance_m,'gradient':(h2-h1)/distance_m,
            'vertical_datum':'NAVD88','calculation_only':True,
            'engineering_certification':False}

def enqueue(outbox: Path, layer_id: str, manifest: dict, destination: str) -> dict:
    """Send only to a local on-disk outbox; no socket or unauthorized network calls."""
    destination_gate = route_evidence(manifest, destination)
    queue = ({'QUARANTINE':'QUARANTINE', 'REVIEW_QUEUE':'REVIEW',
              'VISUALIZATION_WITH_WARNING':'VISUALIZATION',
              'ENGINEERING_REVIEW_READY':'ENGINEERING_REVIEW'}[destination_gate])
    payload = {'schema':'tsm-geodetic-route-v1', 'layer_id':layer_id,
               'requested_destination':destination,'destination':queue,
               'route':destination_gate, 'manifest':manifest,
               'evidence_approval_is_not_automatic':True}
    raw = (json.dumps(payload,sort_keys=True,separators=(',',':'))+'\n').encode()
    digest = hashlib.sha256(raw).hexdigest()
    directory = Path(outbox)/queue
    directory.mkdir(parents=True,exist_ok=True)
    file = directory/(digest+'.json')
    # Atomic publish, content-addressed. Never remove previous events.
    try:
        with file.open('xb') as fp:
            fp.write(raw)
            fp.flush()
            os.fsync(fp.fileno())
    except FileExistsError:
        if sha256_file(file) != digest:
            raise GateError('OUTBOX_FILE_TAMPERED')
    return {'destination':queue, 'route':destination_gate, 'outbox_file':str(file),
            'sha256':digest}


def dispatch(event: dict) -> dict:
    """JSON-lines transport with explicit operations (stdin/stdout, no daemon)."""
    try:
        operation=event.get('op')
        if operation == 'transform':
            op = choose_transformer(event.get('src_epsg'),event.get('target_epsg',2966))
            x,y=op.transform(float(event['x']),float(event['y']),errcheck=True)
            return {'status':'HORIZONTAL_ONLY', 'source_epsg':event['src_epsg'],
                    'target_epsg':event.get('target_epsg',2966), 'x':x,'y':y,
                    'vertical_datum_verified':False,'control_verified':False,
                    'engineering_approved':False}
        if operation == 'route':
            return {'status':'ROUTED','receipt':enqueue(Path(event['outbox']),
                      str(event['layer_id']),dict(event['manifest']),str(event['to']))}
        if operation == 'check':
            return {'status':'OK','schema':'tsm-geodetic-jsonl-v1',
                    'headless':True,'transport':'stdio','engineering_approved':False}
        raise GateError('UNKNOWN_OPERATION')
    except (GateError, KeyError, ValueError, TypeError) as e:
        return {'status':'BLOCKED','error':str(e),'engineering_approved':False}


def serve_jsonl(stdin=sys.stdin, stdout=sys.stdout):
    """The app owns the process; input is one JSON object per line."""
    for line in stdin:
        try:
            request=json.loads(line)
            if not isinstance(request,dict): raise ValueError('Expected JSON object')
            result=dispatch(request)
        except (json.JSONDecodeError,ValueError) as exc:
            result={'status':'BLOCKED','error':'INVALID_JSON: '+str(exc)}
        stdout.write(json.dumps(result,sort_keys=True)+'\n')
        stdout.flush()


class Engine:
    """Offline append-only SQLite evidence ledger; no database/web server required."""
    def __init__(self, db: Path):
        self.db = Path(db)
        self.db.parent.mkdir(parents=True,exist_ok=True)
        with self._connect() as conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS events(
                 event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                 layer_id TEXT NOT NULL, event_type TEXT NOT NULL,
                 recorded_utc TEXT NOT NULL, body_json TEXT NOT NULL,
                 payload_sha256 TEXT NOT NULL, previous_event_sha256 TEXT,
                 event_sha256 TEXT NOT NULL)''')
            conn.execute('CREATE INDEX IF NOT EXISTS events_layer_idx ON events(layer_id,event_id)')
    def _connect(self):
        return sqlite3.connect(str(self.db), timeout=5)
    def append(self,layer_id:str, body:dict,event_type='update'):
        if not layer_id or len(layer_id)>256 or event_type not in {'ingest','correction','review','route','transform','grid'}:
            raise GateError('INVALID_EVENT')
        canonical=json.dumps(body,sort_keys=True,separators=(',',':'),ensure_ascii=False)
        payload=hashlib.sha256(canonical.encode()).hexdigest()
        ts=dt.datetime.now(dt.timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute('BEGIN IMMEDIATE')
            row=conn.execute('SELECT event_sha256 FROM events ORDER BY event_id DESC LIMIT 1').fetchone()
            prev=row[0] if row else None
            digest=hashlib.sha256(json.dumps([layer_id,event_type,ts,payload,prev],separators=(',',':')).encode()).hexdigest()
            conn.execute('''INSERT INTO events(layer_id,event_type,recorded_utc,body_json,payload_sha256,previous_event_sha256,event_sha256)
              VALUES(?,?,?,?,?,?,?)''',(layer_id,event_type,ts,canonical,payload,prev,digest))
        return {'event_sha256':digest,'payload_sha256':payload,'previous_event_sha256':prev}
    def history(self,layer_id:str):
        with self._connect() as conn:
            rows=conn.execute('SELECT event_type,recorded_utc,body_json,payload_sha256,event_sha256 FROM events WHERE layer_id=? ORDER BY event_id',(layer_id,)).fetchall()
        return [{'event_type':r[0],'utc':r[1],'body':json.loads(r[2]),'payload_sha256':r[3],'event_sha256':r[4]} for r in rows]
    def latest(self,layer_id:str):
        h=self.history(layer_id)
        return h[-1]['body'] if h else None
    def verify_chain(self):
        prev = None
        with self._connect() as con:
            rows = con.execute('SELECT event_id,layer_id,event_type,recorded_utc,body_json,payload_sha256,previous_event_sha256,event_sha256 FROM events ORDER BY event_id').fetchall()
        for id,layer,event,ts,body,sha,previous,stored in rows:
            calcsha = hashlib.sha256(body.encode()).hexdigest()
            digest = hashlib.sha256(json.dumps([layer,event,ts,sha,prev],separators=(',',':')).encode()).hexdigest()
            if calcsha != sha or previous != prev or digest != stored:
                return {'verified':False,'first_bad_event_id':id,'checked_event_count':len(rows)}
            prev = stored
        return {'verified':True,'checked_event_count':len(rows),'head_sha256':prev}


def inspect_bundle(p:Path)->dict:
    """Read-only native CRS census from eight nested official DNR ZIPs."""
    from collections import Counter
    with zipfile.ZipFile(p) as outer:
        if outer.testzip(): raise GateError('OUTER_ZIP_CORRUPTION')
        receipt=json.loads(outer.read('source-acquisition-receipt.json'))
        expected={x['relativePath']:x['sha256'].lower() for x in receipt['records']}
        layers,archives=[],[]
        for n in sorted(x for x in outer.namelist() if x.endswith('.zip')):
            data=outer.read(n)
            with zipfile.ZipFile(io.BytesIO(data)) as inner:
                if inner.testzip():raise GateError('INNER_ZIP_CORRUPTION: '+n)
                digest=hashlib.sha256(data).hexdigest()
                archives.append({'path':n,'sha256':digest,'receipt_match':digest==expected.get(n)})
                names={x.lower():x for x in inner.namelist()}
                for shp in sorted(x for x in inner.namelist() if x.lower().endswith('.shp')):
                    prj=names.get(shp[:-4].lower()+'.prj')
                    layer={'archive':n,'name':shp,'epsg':None,'horizontal_units':None,
                           'wkt_sha256':None,'vertical_datum':None,'state':'MISSING_SOURCE_PRJ'}
                    if prj:
                        raw=inner.read(prj)
                        try:
                            crs=CRS.from_wkt(raw.decode('utf-8-sig'))
                            layer.update(epsg=crs.to_epsg(),horizontal_units=[x.unit_name for x in crs.axis_info],
                                wkt_sha256=hashlib.sha256(raw).hexdigest(),state='SOURCE_PRJ_PARSED')
                        except ValueError:
                            layer['state']='INVALID_SOURCE_PRJ'
                    layers.append(layer)
    return {'schema':'tsm-native-dnr-source-inventory-v1','bundle_sha256':sha256_file(p),
      'archives':archives,'layers':layers,'summary':{'count':len(layers),
      'epsg_counts':dict(Counter(str(x['epsg']) for x in layers)),
      'source_archives_verified':all(x['receipt_match'] for x in archives)},
      'engineering_approved':False}


def _write_json(path:Path,result:dict):
    path=Path(path)
    if path.exists(): raise GateError('OUTPUT_EXISTS: refuse to overwrite evidence files')
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n')


def cli(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    sub=p.add_subparsers(dest='command',required=True)
    b=sub.add_parser('inspect');b.add_argument('--bundle',type=Path,required=True);b.add_argument('--output',type=Path,required=True)
    b=sub.add_parser('grid-verify');b.add_argument('--file',type=Path,required=True);b.add_argument('--sha256')
    b=sub.add_parser('grid-fetch');b.add_argument('--output',type=Path,required=True);b.add_argument('--sha256')
    b=sub.add_parser('grid-install');b.add_argument('--file',type=Path,required=True);b.add_argument('--sha256',required=True);b.add_argument('--directory',type=Path,required=True)
    b=sub.add_parser('transform-point');b.add_argument('--src-epsg',type=int,required=True);b.add_argument('--dst-epsg',type=int,default=2966);b.add_argument('x',type=float);b.add_argument('y',type=float)
    b=sub.add_parser('derive-geojson');b.add_argument('--src-epsg',type=int,required=True);b.add_argument('--dst-epsg',type=int,default=2966);b.add_argument('--input',type=Path,required=True);b.add_argument('--output',type=Path,required=True)
    b=sub.add_parser('controls');b.add_argument('--src-epsg',type=int,required=True);b.add_argument('--dst-epsg',type=int,default=2966);b.add_argument('--input',type=Path,required=True);b.add_argument('--threshold-m',type=float,default=.15);b.add_argument('--output',type=Path,required=True)
    b=sub.add_parser('route');b.add_argument('--manifest',type=Path,required=True);b.add_argument('--to',choices=['engineering','visualization','review'],required=True);b.add_argument('--ledger',type=Path,required=True);b.add_argument('--layer',required=True)
    b=sub.add_parser('correct');b.add_argument('--manifest',type=Path,required=True);b.add_argument('--ledger',type=Path,required=True);b.add_argument('--layer',required=True)
    b=sub.add_parser('enqueue');b.add_argument('--manifest',type=Path,required=True);b.add_argument('--to',choices=['engineering','visualization','review'],required=True);b.add_argument('--outbox',type=Path,required=True);b.add_argument('--layer',required=True)
    b=sub.add_parser('history');b.add_argument('--ledger',type=Path,required=True);b.add_argument('--layer',required=True)
    b=sub.add_parser('verify-ledger');b.add_argument('--ledger',type=Path,required=True)
    b=sub.add_parser('stdio');b=sub.add_parser('grid-source')
    b=sub.add_parser('covariance');b.add_argument('--src-epsg',type=int,required=True);b.add_argument('--dst-epsg',type=int,default=2966);b.add_argument('--x',type=float,required=True);b.add_argument('--y',type=float,required=True);b.add_argument('--sigma-x-m',type=float,required=True);b.add_argument('--sigma-y-m',type=float,required=True);b.add_argument('--covariance-xy-m2',type=float,default=0.0)
    args=p.parse_args(argv)
    try:
        if args.command=='stdio': serve_jsonl(); return 0
        elif args.command=='grid-source': report={'grid_name':GRID_NAME,'official_url':GRID_URL,'official_license':'public domain','download_status':'MANUAL_OR_CONTROLLED_FETCH_REQUIRED','tested_grid_installed':False}
        elif args.command=='inspect':
            report=inspect_bundle(args.bundle);_write_json(args.output,report)
        elif args.command=='covariance':report=propagate_covariance(args.src_epsg,args.dst_epsg,args.x,args.y,args.sigma_x_m,args.sigma_y_m,args.covariance_xy_m2)
        elif args.command=='grid-verify':report=verify_grid(args.file,expected_sha256=args.sha256)
        elif args.command=='grid-fetch':report=fetch_official_grid(args.output,expected_sha256=args.sha256)
        elif args.command=='grid-install':report=install_grid(args.file,args.directory,expected_sha256=args.sha256)
        elif args.command=='transform-point':
            op=choose_transformer(args.src_epsg,args.dst_epsg)
            x,y=op.transform(args.x,args.y,errcheck=True)
            report={'sourceEPSG':args.src_epsg,'targetEPSG':args.dst_epsg,'x':x,'y':y,
                    'operation':op.description,'operationAccuracyMeters':op.accuracy,
                    'verticalValidation':False,'surveyControlValidation':False,
                    'approvedForEngineering':False,'projVersion':proj_version_str}
        elif args.command=='derive-geojson':
            data=json.loads(args.input.read_text())
            out=derive_derived_geojson(data,args.src_epsg,args.dst_epsg)
            _write_json(args.output,out)
            report={'output':str(args.output),'featureCount':len(out['features']),
                    'sourceEPSG':args.src_epsg,'targetEPSG':args.dst_epsg,
                    'verticalDatumVerified':False,'engineeringApproved':False}
        elif args.command=='controls':
            controls=json.loads(args.input.read_text())
            report=control_residuals(choose_transformer(args.src_epsg,args.dst_epsg),controls,args.threshold_m)
            _write_json(args.output,report)
        elif args.command=='route':
            record=json.loads(args.manifest.read_text())
            result=route_evidence(record,args.to)
            receipt=Engine(args.ledger).append(args.layer,{'requested_destination':args.to,'route':result,'manifest_sha256':sha256_file(args.manifest)},event_type='route')
            report={'route':result,**receipt}
        elif args.command=='enqueue':
            report=enqueue(args.outbox,args.layer,json.loads(args.manifest.read_text()),args.to)
        elif args.command=='correct':
            record=json.loads(args.manifest.read_text())
            if record.get('engineering_approved') is True:
                raise GateError('MANUAL_APPROVAL_MUTATION_FORBIDDEN: source must undergo separate review')
            report=Engine(args.ledger).append(args.layer,record,event_type='correction')
        elif args.command=='history':report={'history':Engine(args.ledger).history(args.layer)}
        elif args.command=='verify-ledger':report=Engine(args.ledger).verify_chain()
        else:raise GateError('UNKNOWN_COMMAND')
        print(json.dumps(report,sort_keys=True))
        return 0
    except (GateError,ValueError,KeyError,OSError,zipfile.BadZipFile) as e:
        print(json.dumps({'state':'BLOCKED','error':str(e),'engineering_approved':False}),file=sys.stderr)
        return 2

if __name__=='__main__':sys.exit(cli())
