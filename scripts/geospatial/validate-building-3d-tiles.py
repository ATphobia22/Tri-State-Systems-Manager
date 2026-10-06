#!/usr/bin/env python3
"""Strict validation for TSM building 3D Tiles artifacts."""
from __future__ import annotations
import argparse,hashlib,json,math,struct
from pathlib import Path
D="KHR_draco_mesh_compression"
def fail(s): raise SystemExit(f"ERROR: {s}")
def fin(x): return isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)
def ar(x,n): return isinstance(x,list) and len(x)==n and all(fin(v) for v in x)
def bv(v,l):
 if not isinstance(v,dict): fail(f"{l}: boundingVolume must be object")
 ks=[k for k in ("box","sphere","region") if k in v]
 if len(ks)!=1 or not ar(v[ks[0]],12 if ks[0]=="box" else 4 if ks[0]=="sphere" else 6): fail(f"{l}: invalid boundingVolume")
 if ks[0]=="box" and any(vv<0 for vv in (v["box"][3],v["box"][7],v["box"][11])): fail(f"{l}: negative box axis")
 if ks[0]=="sphere" and v["sphere"][3]<0: fail(f"{l}: negative sphere radius")
def safe(s):
 if not isinstance(s,str) or not s or s.startswith(("/", "\\")) or "\\" in s or "://" in s or Path(s).is_absolute() or ".." in Path(s).parts or Path(s).suffix.lower()!=".glb": fail(f"unsafe/non-GLB URI: {s!r}")
 return s
def glb(p,req):
 d=p.read_bytes()
 if len(d)<20 or d[:4]!=b"glTF" or struct.unpack_from("<I",d,4)[0]!=2 or struct.unpack_from("<I",d,8)[0]!=len(d): fail(f"{p}: invalid GLB")
 o=12; doc=None; binary=b""
 while o<len(d):
  if o+8>len(d): fail(f"{p}: truncated chunk")
  n,t=struct.unpack_from("<I4s",d,o); o+=8
  if o+n>len(d): fail(f"{p}: chunk out of bounds")
  c=d[o:o+n]
  if t==b"JSON": doc=json.loads(c.rstrip(b" ").decode())
  elif t==b"BIN\0": binary=c
  o+=n
 if not isinstance(doc,dict) or doc.get("asset",{}).get("version")!="2.0": fail(f"{p}: glTF version")
 b=doc.get("buffers",[])
 if not b or not isinstance(b[0].get("byteLength"),int) or b[0]["byteLength"]>len(binary): fail(f"{p}: invalid buffer")
 for i,v in enumerate(doc.get("bufferViews",[])):
  o=int(v.get("byteOffset",0)); n=v.get("byteLength")
  if not isinstance(n,int) or o<0 or n<0 or o+n>len(binary): fail(f"{p}: bufferView[{i}] out of bounds")
 used=D in doc.get("extensionsUsed",[]); required=D in doc.get("extensionsRequired",[])
 if req and not (used and required): fail(f"{p}: Draco must be used and required")
 if used:
  for m in doc.get("meshes",[]):
   for prim in m.get("primitives",[]):
    e=prim.get("extensions",{}).get(D)
    if not isinstance(e,dict) or not isinstance(e.get("bufferView"),int): fail(f"{p}: malformed Draco")
 return len(d),used
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("--tileset",required=True,type=Path); ap.add_argument("--expected-buildings",type=int); ap.add_argument("--expected-glbs",type=int); ap.add_argument("--require-draco",action="store_true"); ap.add_argument("--strict-hlod",action="store_true"); a=ap.parse_args()
 root=a.tileset.parent; ts=json.loads(a.tileset.read_text())
 if ts.get("asset",{}).get("version")!="1.1": fail("asset.version must be 1.1")
 t=ts.get("asset",{}).get("extras",{}).get("tsm",{})
 if t.get("authorityClass")!="DERIVED" or t.get("engineeringUse") is not False or t.get("regulatoryUse") is not False: fail("invalid TSM authority boundary")
 if not fin(ts.get("geometricError")) or ts["geometricError"]<0: fail("invalid tileset geometricError")
 rootnode=ts.get("root")
 if not isinstance(rootnode,dict) or rootnode.get("refine") not in ("ADD","REPLACE"): fail("invalid root")
 uris=[]; ids=[]; nodes=leaves=depthmax=0
 def walk(n,depth=0):
  nonlocal nodes,leaves,depthmax
  nodes+=1; depthmax=max(depthmax,depth); bv(n.get("boundingVolume"),f"tile[{depth}]")
  ge=n.get("geometricError")
  if not fin(ge) or ge<0: fail("invalid tile geometricError")
  if "transform" in n and not ar(n["transform"],16): fail("invalid tile transform")
  if n.get("refine") is not None and n["refine"] not in ("ADD","REPLACE"): fail("invalid refine")
  c=n.get("content"); ch=n.get("children",[])
  if c is not None:
   if not isinstance(c,dict): fail("content must be object")
   u=safe(c.get("uri"))
   if u in uris: fail(f"duplicate content URI: {u}")
   uris.append(u)
   if ch and a.strict_hlod: fail("strict HLOD tile has content and children")
  if not isinstance(ch,list): fail("children must be array")
  if ch:
   for x in ch:
    if not isinstance(x,dict): fail("child must be object")
    walk(x,depth+1)
  else: leaves+=1
  sid=n.get("extras",{}).get("tsm",{}).get("sourceObjectId")
  if sid is not None:
   if not isinstance(sid,int) or sid<0: fail("invalid sourceObjectId")
   ids.append(sid)
 walk(rootnode)
 if len(ids)!=len(set(ids)): fail("duplicate sourceObjectId")
 manp=root/"manifest.json"
 if not manp.is_file(): fail("missing manifest.json")
 man=json.loads(manp.read_text())
 if man.get("authorityClass")!="DERIVED" or man.get("engineeringUse") is not False or man.get("regulatoryUse") is not False: fail("invalid manifest authority boundary")
 if man.get("content") is not None and sorted(man["content"])!=sorted(uris): fail("manifest content mismatch")
 if a.expected_buildings is not None:
  count=len(ids) or man.get("sourceBuildingCount",man.get("buildingCount",0))
  if count!=a.expected_buildings: fail(f"expected {a.expected_buildings} buildings, found {count}")
 if a.expected_glbs is not None and len(uris)!=a.expected_glbs: fail(f"expected {a.expected_glbs} GLBs, found {len(uris)}")
 total=draco=0
 for u in uris:
  p=root/u
  if not p.is_file(): fail(f"missing referenced GLB: {u}")
  n,d=glb(p,a.require_draco); total+=n; draco+=int(d)
 allglb={p.relative_to(root).as_posix() for p in root.rglob("*.glb")}
 if allglb-set(uris): fail(f"orphan GLBs: {sorted(allglb-set(uris))[:10]}")
 hp=root/"SHA256SUMS"
 if not hp.is_file(): fail("missing SHA256SUMS")
 expected={}
 for line in hp.read_text().splitlines():
  if not line.strip(): continue
  x=line.split("  ",1)
  if len(x)!=2 or len(x[0])!=64: fail("malformed SHA256SUMS")
  expected[x[1]]=x[0]
 wanted={a.tileset.name,"manifest.json",*uris}
 if set(expected)!=wanted: fail("SHA256SUMS path set mismatch")
 for rel in wanted:
  if hashlib.sha256((root/rel).read_bytes()).hexdigest()!=expected[rel]: fail(f"SHA-256 mismatch: {rel}")
 print(json.dumps({"ok":True,"nodes":nodes,"leaves":leaves,"maxDepth":depthmax,"buildingIds":len(ids),"glbCount":len(uris),"dracoCount":draco,"bytes":total,"sha256Verified":True}))
if __name__=="__main__": main()
