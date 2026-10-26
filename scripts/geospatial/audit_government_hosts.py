#!/usr/bin/env python3
"""Privacy-safe inventory of government/reference hosts in an entire repo.

All known text file paths are traversed, not a hand-picked sample.
Output contains host names and count of referencing files only. It never
emits URL paths, query strings, addresses, tokens, or document contents.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

URL=re.compile(r'https?://[^\s\'"<>`{}\\]+',re.IGNORECASE)
TEXT={'.py','.ts','.tsx','.js','.jsx','.json','.jsonl','.md','.mdx','.txt','.html','.htm','.yml','.yaml','.xml','.sql','.toml','.ini','.cfg','.sh','.ps1','.cs','.cpp','.h','.hpp','.rs','.go','.csv'}
SKIP={'.git','node_modules','dist','build','.venv','venv','__pycache__','.next','.cache','.turbo','target'}
MAX_BYTES=2*1024*1024


def is_official_host(host):
    h=host.lower().strip('.')
    return h.endswith(('.gov','.mil')) or h in ('registry.opendata.aws','data.gov','www.data.gov')


def inventory(root):
    root=Path(root).resolve()
    if not root.is_dir(): raise ValueError('Root must be a directory')
    files=0; scanned=0; skipped_oversized=0; skipped_nontext=0; bad_http=set()
    refs=defaultdict(set)
    for path in sorted(root.rglob('*')):
        if not path.is_file() or path.is_symlink() or any(part in SKIP for part in path.relative_to(root).parts):continue
        files+=1
        if path.suffix.lower() not in TEXT:
            skipped_nontext+=1;continue
        if path.stat().st_size>MAX_BYTES:
            skipped_oversized+=1;continue
        scanned+=1
        try: data=path.read_text(encoding='utf-8',errors='replace')
        except OSError: continue
        for m in URL.finditer(data):
            url=m.group(0).rstrip(').,;]')
            try:p=urlsplit(url);host=(p.hostname or '').lower()
            except ValueError:continue
            if not is_official_host(host):continue
            refs[host].add(path.relative_to(root).as_posix())
            if p.scheme.lower()=='http':bad_http.add(host)
    return {
        'schemaVersion':'tsm.government-host-inventory.v1',
        'classification':'REPO_REFERENCE_ONLY',
        'engineeringUse':False,
        'regulatoryUse':False,
        'claimsAllFilesRead':False,
        'scanLimitBytesPerTextFile':MAX_BYTES,
        'trackedFileCandidates':files,
        'textFilesScanned':scanned,
        'oversizedTextFilesSkipped':skipped_oversized,
        'nonTextFilesSkipped':skipped_nontext,
        'governmentHostCount':len(refs),
        'governmentHosts':[
            {'host':host,'fileReferenceCount':len(paths),
             'sampleFilePaths':sorted(paths)[:10],
             'samplePathsTruncated':len(paths)>10}
            for host,paths in sorted(refs.items())
        ],
        'hostsMentionedViaPlainHttp':sorted(bad_http),
        'sourceNotice':'A government domain reference is not a live service verification, API authorization, data acquisition, or evidence of an approved engineering source. Text files over the explicit size limit and non-text files are not scanned. No URL paths or query strings are exported.',
    }


def main():
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument('--root',type=Path,default=Path('.'))
    a.add_argument('--out',type=Path,required=True)
    args=a.parse_args()
    if args.out.exists(): a.error('Cannot overwrite reference inventory')
    result=inventory(args.root)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,sort_keys=True,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'governmentHostCount':result['governmentHostCount'],
        'textFilesScanned':result['textFilesScanned'],
        'oversizedTextFilesSkipped':result['oversizedTextFilesSkipped'],
        'topHosts':sorted(((x['host'],x['fileReferenceCount']) for x in result['governmentHosts']),
                 key=lambda x:-x[1])[:20]},sort_keys=True))

if __name__=='__main__':main()