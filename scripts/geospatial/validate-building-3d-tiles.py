#!/usr/bin/env python3
"""Strict TSM building 3D Tiles 1.1 validator."""
from __future__ import annotations
import argparse,hashlib,json,math,struct
from pathlib import Path
D="KHR_draco_mesh_compression"
def fail(s): raise SystemExit(f"FAIL: {s}")
def finite(x): return isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)
def array(x,n): return isinstance(x,list) and len(x)==n and all(finite(v) for v in x)
def check_bv(v,label):
 if not isinstance(v,dict): fail(f"{label}: boundingVolume is not an object")
 ks=[k for k in("box","sphere","region") if k in v]
 if len(ks)!=1 or not array(v[ks[0]],12 if ks[0]=="box" else 4 if ks[0]=="sphere" else 6): fail(f"{label}: invalid boundingVolume")
 if ks[0]=="box" and any(v["box"][i]<=0 for i in(3,7,11)): fail(f"{label}: box half-axis must be positive")
 if ks[0]=="sphere" and v["sphere"][3]<0: fail(f"{label}: negative sphere radius")
def safe_uri(u):
 if not isinstance(u,str) or not u or u.startswith(("/", "\\")) or "\\" in u or "://" in u or Path(u).is_absolute() or ".." in Path(u).parts or Path(u).suffix.lower()!=".glb": fail(f"unsafe content URI: {u!r}")
 return u
def check_glb(p,require_draco=False):
 d=p.read_bytes()
 if len(d)<20 or d[:4]!=b"glTF" or struct.unpack_from("<I",d,4)[0]!=2 or struct.unpack_from("<I",d,8)[0]!=len(d): fail(f"{p}: invalid GLB header")
 o=12; doc=None; binary=b""
 while o<len(d):
  if o+8>len(d): fail(f"{p}: truncated chunk")
  n,t=struct.unpack_from("<I4s",d,o); o+=8
  if o+n>len(d): fail(f"{p}: chunk exceeds file")
  c=d[o:o+n]
  if t==b"JSON": doc=json.loads(c.rstrip(b" ").decode())
  elif t==b"BIN\0": binary=c
  o+=n
 if not isinstance(doc,dict) or doc.get("asset",{}).get("version")!="2.0": fail(f"{p}: glTF asset.version != 2.0")
 buffers=doc.get("buffers",[])
 if not buffers or not isinstance(buffers[0].get("byteLength"),int) or buffers[0]["byteLength"]>len(binary): fail(f"{p}: invalid buffer length")
 for i,v in enumerate(doc.get("bufferViews",[])):
  off=int(v.get("byteOffset",0)); n=v.get("byteLength")
  if not isinstance(n,int) or off<0 or n<0 or off+n>len(binary): fail(f"{p}: bufferView[{i}] out of bounds")
 used=D in doc.get("extensionsUsed",[]); req=D in doc.get("extensionsRequired",[])
 if require_draco and not(used and req): fail(f"{p}: Draco must be present in extensionsUsed and extensionsRequired")
 if used:
  for m in doc.get("meshes",[]):
   for prim in m.get("primitives",[]):
    ext=prim.get("extensions",{}).get(D)
    if not isinstance(ext,dict) or not isinstance(ext.get("bufferView"),int): fail(f"{p}: malformed Draco primitive")
 return used
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("--tileset",required=True,type=Path); ap.add_argument("--tiles-dir",type=Path); ap.add_argument("--expected-buildings",type=int); ap.add_argument("--expected-glbs",type=int); ap.add_argument("--require-draco",action="store_true"); ap.add_argument("--strict-hlod",action="store_true"); a=ap.parse_args()
 root=a.tiles_dir.resolve() if a.tiles_dir else a.tileset.parent.resolve(); ts=json.loads(a.tileset.read_text())
 if ts.get("asset",{}).get("version")!="1.1": fail("asset.version must be 1.1")
 tsm=ts.get("asset",{}).get("extras",{}).get("tsm",{})
 if tsm.get("authorityClass")!="DERIVED" or tsm.get("engineeringUse") is not False or tsm.get("regulatoryUse") is not False: fail("invalid authority boundary")
 uris=[]; ids=[]; nodes=leaves=0
 def walk(n,depth=0):
  nonlocal nodes,leaves
  nodes+=1; check_bv(n.get("boundingVolume"),f"tile[{depth}]")
  ge=n.get("geometricError")
  if not finite(ge) or ge<0: fail(f"tile[{depth}]: invalid geometricError")
  if "transform" in n and not array(n["transform"],16): fail(f"tile[{depth}]: invalid transform")
  if n.get("refine") not in("ADD","REPLACE",None): fail(f"tile[{depth}]: invalid refine")
  c=n.get("content"); ch=n.get("children",[])
  if c is not None:
   if not isinstance(c,dict): fail("content must be object")
   u=safe_uri(c.get("uri"))
   if u in uris: fail(f"duplicate content URI: {u}")
   uris.append(u)
   if ch and a.strict_hlod: fail(f"tile[{depth}]: strict HLOD forbids content+children")
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
 walk(ts["root"])
 if len(ids)!=len(set(ids)): fail("duplicate sourceObjectId")
 for u in uris:
  p=root/u
  if not p.is_file(): fail(f"missing content file: {u}")
  check_glb(p,a.require_draco)
 all_glb={p.relative_to(root).as_posix() for p in root.rglob("*.glb")}
 orphans=all_glb-set(uris)
 if orphans: fail(f"orphan GLB files: {sorted(orphans)[:10]}")
 if a.expected_glbs is not None and len(uris)!=a.expected_glbs: fail(f"expected {a.expected_glbs} content GLBs, found {len(uris)}")
 if a.expected_buildings is not None:
  manifest_path=root/"manifest.json"; manifest=json.loads(manifest_path.read_text()) if manifest_path.is_file() else {}
  declared_ids=manifest.get("stitchedSourceObjectIds") if a.strict_hlod else None
  if declared_ids is not None:
   if not isinstance(declared_ids,list) or any(not isinstance(x,int) or x<0 for x in declared_ids):
    fail("manifest stitchedSourceObjectIds is invalid")
   if len(declared_ids)!=len(set(declared_ids)):
    fail("manifest stitchedSourceObjectIds contains duplicates")
   if len(declared_ids)!=a.expected_buildings:
    fail(f"expected {a.expected_buildings} stitched buildings, found {len(declared_ids)}")
   stitched=manifest.get("stitchedTiles")
   if not isinstance(stitched,dict) or not stitched:
    fail("strict HLOD manifest is missing stitchedTiles identity mapping")
   flattened=[]
   for tile_name,tile_meta in stitched.items():
    if not isinstance(tile_meta,dict) or not isinstance(tile_meta.get("sourceObjectIds"),list) or not tile_meta["sourceObjectIds"]:
     fail(f"invalid stitched identity mapping: {tile_name}")
    flattened.extend(tile_meta["sourceObjectIds"])
   if len(flattened)!=len(set(flattened)):
    fail("stitched identity mapping contains duplicate sourceObjectIds")
   if sorted(flattened)!=sorted(declared_ids):
    fail("stitched identity mapping does not equal stitchedSourceObjectIds")
   if manifest.get("stitchedTileCount")!=len(stitched):
    fail("stitchedTileCount does not match stitchedTiles mapping")
   if manifest.get("input",{}).get("featureCount") not in (None, a.expected_buildings):
    fail("manifest input featureCount does not match expected source contract")
  else:
   count=len(ids) or manifest.get("sourceBuildingCount",manifest.get("buildingCount",manifest.get("input",{}).get("featureCount",0)))
   if count!=a.expected_buildings: fail(f"expected {a.expected_buildings} buildings, found {count}")
 hp=root/"SHA256SUMS"
 if hp.is_file():
  expected={}
  for line in hp.read_text().splitlines():
   if line.strip():
    x=line.split("  ",1)
    if len(x)!=2: fail("malformed SHA256SUMS")
    expected[x[1]]=x[0]
  wanted={a.tileset.name,*uris}
  if "manifest.json" in {p.name for p in root.iterdir()}: wanted.add("manifest.json")
  if set(expected)!=wanted: fail("SHA256SUMS does not exactly match validated content")
  for rel,digest in expected.items():
   if hashlib.sha256((root/rel).read_bytes()).hexdigest()!=digest: fail(f"SHA-256 mismatch: {rel}")
 print(json.dumps({"ok":True,"nodes":nodes,"leaves":leaves,"contentGlbs":len(uris),"buildingIds":len(ids),"sha256Verified":hp.is_file()}))
if __name__=="__main__":main()
