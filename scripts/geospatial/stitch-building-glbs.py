#!/usr/bin/env python3
"""Transform-aware deterministic HLOD leaf GLB stitcher."""
from __future__ import annotations
import argparse,json,struct
from pathlib import Path
def fail(s): raise SystemExit(f"FAIL: {s}")
def read_glb(p):
 d=p.read_bytes()
 if len(d)<20 or d[:4]!=b"glTF" or struct.unpack_from("<I",d,4)[0]!=2: fail(f"invalid GLB {p}")
 o=12; doc=None; binary=b""
 while o<len(d):
  n,t=struct.unpack_from("<I4s",d,o); o+=8; c=d[o:o+n]
  if t==b"JSON": doc=json.loads(c.rstrip(b" ").decode())
  elif t==b"BIN\0": binary=c
  o+=n
 if not isinstance(doc,dict): fail(f"missing GLB JSON {p}")
 return doc,binary
def vals(doc,binary,idx):
 a=doc["accessors"][idx]; v=doc["bufferViews"][a["bufferView"]]
 if a.get("type")!="VEC3" or a.get("componentType")!=5126: fail("stitcher requires FLOAT VEC3 accessors")
 off=int(v.get("byteOffset",0))+int(a.get("byteOffset",0)); stride=int(v.get("byteStride",12))
 if stride!=12: fail("stitcher requires tightly packed VEC3 accessors")
 return [struct.unpack_from("<3f",binary,off+i*12) for i in range(a["count"])]
def p(m,p): return(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14])
def n(m,v):
 x=m[0]*v[0]+m[4]*v[1]+m[8]*v[2]; y=m[1]*v[0]+m[5]*v[1]+m[9]*v[2]; z=m[2]*v[0]+m[6]*v[1]+m[10]*v[2]; q=(x*x+y*y+z*z)**.5 or 1; return(x/q,y/q,z/q)
def make(groups):
 binary=bytearray(); views=[]; acc=[]; mats=[]; prims=[]
 for ps,ns,color in groups:
  pb=b"".join(struct.pack("<3f",*x) for x in ps); nb=b"".join(struct.pack("<3f",*x) for x in ns); po=len(binary); binary.extend(pb); no=len(binary); binary.extend(nb)
  pv=len(views); views.append({"buffer":0,"byteOffset":po,"byteLength":len(pb),"target":34962}); nv=len(views); views.append({"buffer":0,"byteOffset":no,"byteLength":len(nb),"target":34962})
  ai=len(acc); lo=[min(x[i] for x in ps) for i in range(3)]; hi=[max(x[i] for x in ps) for i in range(3)]; acc.append({"bufferView":pv,"componentType":5126,"count":len(ps),"type":"VEC3","min":lo,"max":hi}); ni=len(acc); acc.append({"bufferView":nv,"componentType":5126,"count":len(ns),"type":"VEC3"})
  mi=len(mats); mats.append({"pbrMetallicRoughness":{"baseColorFactor":color,"metallicFactor":0.0,"roughnessFactor":0.9}}); prims.append({"attributes":{"POSITION":ai,"NORMAL":ni},"mode":4,"material":mi})
 while len(binary)%4: binary.append(0)
 doc={"asset":{"version":"2.0","generator":"TSM transform-aware HLOD stitcher v2"},"scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"mesh":0,"matrix":[1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1]}],"meshes":[{"primitives":prims}],"materials":mats,"buffers":[{"byteLength":len(binary)}],"bufferViews":views,"accessors":acc}
 j=json.dumps(doc,separators=(",",":")).encode(); j+=b" "*((4-len(j)%4)%4); return struct.pack("<4sII",b"glTF",2,12+8+len(j)+8+len(binary))+struct.pack("<I4s",len(j),b"JSON")+j+struct.pack("<I4s",len(binary),b"BIN\0")+binary
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("--tileset",required=True,type=Path); ap.add_argument("--tiles-dir",required=True,type=Path); ap.add_argument("--output",required=True,type=Path); ap.add_argument("--stitched-dir",type=Path); a=ap.parse_args()
 ts=json.loads(a.tileset.read_text()); outdir=a.stitched_dir or a.tiles_dir/"stitched"; outdir.mkdir(parents=True,exist_ok=True); count=0
 manifest_path=outdir.parent/"manifest.json"
 manifest=json.loads(manifest_path.read_text()) if manifest_path.is_file() else {}
 manifest.setdefault("stitchedTiles", {})
 def visit(node):
  nonlocal count
  ch=node.get("children",[])
  if ch and all(isinstance(x,dict) and "content" in x for x in ch):
   groups={}
   source_ids=[]
   for child in ch:
    uri=child["content"]["uri"]; sid=child.get("extras",{}).get("tsm",{}).get("sourceObjectId")
    if not isinstance(sid,int) or sid < 0: fail(f"missing sourceObjectId for stitched child: {uri}")
    source_ids.append(sid)
    doc,binary=read_glb(a.tiles_dir/uri); tr=child.get("transform")
    if not isinstance(tr,list) or len(tr)!=16: fail(f"building transform missing: {uri}")
    prim=doc["meshes"][0]["primitives"][0]; attrs=prim["attributes"]; ps=vals(doc,binary,attrs["POSITION"]); ns=vals(doc,binary,attrs["NORMAL"])
    color=doc.get("materials",[{}])[0].get("pbrMetallicRoughness",{}).get("baseColorFactor",[.6,.57,.52,1]); key=json.dumps(color,separators=(",",":")); groups.setdefault(key,([],[],color)); gp,gn,_=groups[key]
    for pp,nn in zip(ps,ns): gp.append(p(tr,pp)); gn.append(n(tr,nn))
   name=f"tile-{count:04d}.glb"; (outdir/name).write_bytes(make([groups[k] for k in sorted(groups)])); node.pop("children",None); node["content"]={"uri":f"stitched/{name}"}
   manifest["stitchedTiles"][name]={"sourceObjectIds":sorted(source_ids),"sourceObjectCount":len(source_ids)}
   count+=1
  else:
   for x in ch: visit(x)
 visit(ts["root"]); manifest["stitchedTileCount"]=count; manifest["stitchedSourceObjectIds"]=sorted({sid for tile in manifest["stitchedTiles"].values() for sid in tile["sourceObjectIds"]}); manifest_path.write_text(json.dumps(manifest,indent=2)+"\n"); a.output.write_text(json.dumps(ts,separators=(",",":"))+"\n"); print(json.dumps({"stitchedLeaves":count,"sourceObjectIds":len(manifest["stitchedSourceObjectIds"]),"output":str(a.output)}))
if __name__=="__main__":main()
