#!/usr/bin/env python3
"""Local USGS observation snapshots with event time, ingest time and source hashes."""
import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import duckdb


def timestamp(value):
    t = dt.datetime.fromisoformat(value.replace('Z','+00:00'))
    if t.tzinfo is None:
        raise ValueError('timestamp must include timezone')
    return t.astimezone(dt.timezone.utc)


def connect(path, read_only=False):
    c = duckdb.connect(str(path), read_only=read_only,
                       config={'autoinstall_known_extensions':False,'autoload_known_extensions':False})
    c.execute("SET TimeZone='UTC'")
    if not read_only:
        c.execute('''CREATE TABLE IF NOT EXISTS sources(
            sha VARCHAR PRIMARY KEY, source_url VARCHAR NOT NULL, recorded_at TIMESTAMPTZ NOT NULL)''')
        c.execute('''CREATE TABLE IF NOT EXISTS observations(
            source_sha VARCHAR NOT NULL, id VARCHAR NOT NULL, series VARCHAR NOT NULL,
            station VARCHAR NOT NULL, parameter VARCHAR NOT NULL, observed_at TIMESTAMPTZ NOT NULL,
            value DOUBLE, unit VARCHAR NOT NULL, approval VARCHAR, qualifier VARCHAR,
            datum VARCHAR NOT NULL, PRIMARY KEY(source_sha,id))''')
    return c


def ingest(c, path, source_url, recorded_at):
    # A URL is provenance supplied by the operator; this function never fetches it.
    data = Path(path).read_bytes(); digest=hashlib.sha256(data).hexdigest()
    doc=json.loads(data)
    if doc.get('type')!='FeatureCollection':
        raise ValueError('expected archived USGS FeatureCollection')
    recorded=timestamp(recorded_at)
    rows=[]; identifiers=set()
    for feature in doc['features']:
        p=feature['properties']; identity=str(feature['id'])
        if identity in identifiers:
            raise ValueError('duplicate source observation ID')
        identifiers.add(identity)
        raw=p.get('value'); value=None if raw in (None,'') else float(raw)
        if value is not None and not math.isfinite(value):
            raise ValueError('nonfinite observation')
        required=[p[k] for k in ('time_series_id','monitoring_location_id','parameter_code','unit_of_measure')]
        if not all(isinstance(v,str) and v for v in required):
            raise ValueError('missing series/station/parameter/unit')
        observed=timestamp(p['time'])
        if observed > recorded:
            raise ValueError('observation cannot postdate snapshot ingestion')
        rows.append((digest,identity,*required[:3],observed,value,required[3],
                     p.get('approval_status'),json.dumps(p.get('qualifier')), 'UNVERIFIED'))
    c.execute('BEGIN')
    try:
        # Reimporting identical bytes is idempotent; original knowledge time is retained.
        if not c.execute('SELECT 1 FROM sources WHERE sha=?',[digest]).fetchone():
            c.execute('INSERT INTO sources VALUES (?,?,?)',[digest,source_url,recorded])
            if rows:
                c.executemany('INSERT INTO observations VALUES (?,?,?,?,?,?,?,?,?,?,?)',rows)
        c.execute('COMMIT')
    except Exception:
        c.execute('ROLLBACK'); raise
    return {'sha256':digest,'rowsInSource':len(rows),'authority':'ARCHIVED_OBSERVATIONS_NOT_DATUM_VALIDATED'}


def asof(c, series, at, known_at, max_age_seconds):
    if not math.isfinite(max_age_seconds) or max_age_seconds<0:
        raise ValueError('invalid max age')
    event,known=timestamp(at),timestamp(known_at)
    rows=c.execute('''SELECT CAST(o.observed_at AS VARCHAR),o.value,o.unit,o.datum,o.approval,o.qualifier,o.source_sha,CAST(s.recorded_at AS VARCHAR)
        FROM observations o JOIN sources s ON o.source_sha=s.sha
        WHERE o.series=? AND o.observed_at<=? AND s.recorded_at<=?
        ORDER BY o.observed_at DESC,s.recorded_at DESC,o.source_sha DESC LIMIT 1''',[series,event,known]).fetchone()
    if rows is None:
        return {'status':'SOURCE_UNAVAILABLE','value':None}
    observed,value,unit,datum,approval,qualifier,digest,recorded=rows
    observed,recorded=timestamp(observed),timestamp(recorded)
    age=(event-observed).total_seconds()
    status='SOURCE_UNAVAILABLE' if value is None else 'STALE' if age>max_age_seconds else 'LIVE_OBSERVATION'
    return {'status':status,'value':value,'unit':unit,'datum':datum,'approval':approval,
            'qualifier':json.loads(qualifier),'sourceSha256':digest,'observedAt':observed.isoformat(),
            'recordedAt':recorded.isoformat(),'ageSeconds':age,'regulatoryUse':False}


def export_parquet(c, path):
    path=Path(path)
    if path.exists():
        raise ValueError('refusing to overwrite snapshot')
    c.execute('''COPY (SELECT o.*,s.source_url,s.recorded_at FROM observations o
        JOIN sources s ON o.source_sha=s.sha ORDER BY series,observed_at,source_sha,id)
        TO ? (FORMAT PARQUET)''',[str(path)])
    return {'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'rows':c.execute('SELECT count(*) FROM observations').fetchone()[0], 'duckdbVersion':duckdb.__version__}


def main():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('--db',required=True)
    sub=p.add_subparsers(dest='command',required=True)
    i=sub.add_parser('ingest'); i.add_argument('input'); i.add_argument('--source-url',required=True);i.add_argument('--recorded-at',required=True)
    q=sub.add_parser('asof');q.add_argument('--series',required=True);q.add_argument('--at',required=True);q.add_argument('--known-at',required=True);q.add_argument('--max-age-seconds',type=float,default=3600)
    e=sub.add_parser('export');e.add_argument('output')
    a=p.parse_args()
    with connect(a.db,read_only=a.command!='ingest') as c:
        result=ingest(c,a.input,a.source_url,a.recorded_at) if a.command=='ingest' else asof(c,a.series,a.at,a.known_at,a.max_age_seconds) if a.command=='asof' else export_parquet(c,a.output)
    print(json.dumps(result,allow_nan=False))


if __name__=='__main__':main()
