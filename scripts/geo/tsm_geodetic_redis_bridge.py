#!/usr/bin/env python3
"""Optional Redis Streams publisher for approved TSM geodetic event receipts.

Nonvisual/offline Windows runtime never invokes this module. Network use must
be explicitly requested. Geometry and source archives are never transmitted.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import sys

ALLOWED = {'QUARANTINE', 'REVIEW', 'VISUALIZATION', 'ENGINEERING_REVIEW'}
STREAM = 'tsm:geodetic:v1:evidence-events'


def publish_receipt(client, file: Path) -> dict:
    from tsm_geodetic_adapter import sha256_file
    data=json.loads(file.read_text(encoding='utf-8'))
    if file.parent.name not in ALLOWED or data.get('destination') != file.parent.name:
        raise ValueError('ROUTING_DESTINATION_MISMATCH')
    # Only a minimal, non-geometric hash receipt crosses the network boundary.
    fields={'sha256':sha256_file(file),'layer_id':str(data.get('layer_id','')),
            'destination':str(data['destination']), 'route':str(data['route']),
            'schema':'tsm-geodetic-route-v1'}
    if not fields['layer_id']:
        raise ValueError('EMPTY_LAYER_ID')
    redis_id=client.xadd(STREAM,fields,maxlen=10000,approximate=True)
    return {'redis_id':redis_id.decode() if isinstance(redis_id,bytes) else redis_id,
            'stream':STREAM,'file_sha256':fields['sha256'],
            'metadata_only':True}


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--outbox',type=Path,required=True)
    p.add_argument('--allow-network',action='store_true')
    p.add_argument('--url-env',default='TSM_GEO_REDIS_URL')
    args=p.parse_args(argv)
    if not args.allow_network:
        p.error('OFFLINE_DEFAULT: explicit --allow-network required')
    url=os.environ.get(args.url_env)
    if not url:
        p.error('REDIS_URL_NOT_CONFIGURED: use environment, not command argument')
    if not url.startswith(('rediss://','redis://')):
        p.error('UNSUPPORTED_REDIS_SCHEME')
    try:
        import redis
    except ImportError:
        p.error('OPTIONAL_REDIS_DEPENDENCY_MISSING: pip install redis')
    client=redis.Redis.from_url(url,decode_responses=False,socket_timeout=3)
    count=0
    for queue in sorted(ALLOWED):
        for file in sorted((args.outbox/queue).glob('*.json')):
            receipt=publish_receipt(client,file)
            print(json.dumps(receipt,sort_keys=True))
            count+=1
    print(json.dumps({'published':count,'stream':STREAM,'network_mode':'EXPLICIT_OPT_IN'}))
    return 0

if __name__=='__main__':sys.exit(main())
