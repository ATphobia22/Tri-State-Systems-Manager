#!/usr/bin/env python3
"""Deterministically merge every HLOD leaf's building GLBs into one GLB."""
from __future__ import annotations
import argparse,hashlib,json,struct
from pathlib import Path

def fail(s): raise SystemExit(f"ERROR: {s}")
def read_glb(p):
 d=p.read_bytes()
 if len(d)<20 or d[:4]!=b"glTF" or struct.unpack_from("<I",d,4)[0]!=2: fail(f"invalid GLB: {p}")
 o=12; doc=None; binary=b""
 while o<len(d):
  n,t=struct.unpack_from("<I4s",d,o); o+=8; c=d[o:o+n]
  if t==b"JSON": doc=json.loads(c.rstrip(b" ").decode())
  elif t==b"BIN\0": binary=c
  o+=n
 if not isinstance(doc,dict): fail(f"missing GLB JSON: {p}")
 return doc,binary
def pvals(doc,binary,idx):
 a=doc["accessors"][idx]
 if a.get("type")!="VEC3" or a.get("componentType")!=5126: fail("stitcher requires FLOAT VEC3 accessors")
 v=doc["bufferViews"][a["bufferView"]]; base=int(v.get("byteOffset",0))+int(a.get("byteOffset",0))
 stride=int(v.get("byteStride",12))
 if stride!=12: fail("stitcher requires tightly packed VEC3 accessors")
 return [struct.unpack_from("<3f",binary,base+i*12) for i in range(a["count"])]
def tp(m,p):
 return (m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14])
def tn(m,n):
 x=m[0]*n[0]+m[4]*n[1]+m[8]*n[2]; y=m[1]*n[0]+m[5]*n[1]+m[9]*n[2]; z=m[2]*n[0]+m[6]*n[1]+m[10]*n[2]; q=(x*x+y*y+z*z)**.5 or 1
 return (x/q,y/q,z/q)
def make(groups):
 binary=bytearray(); views=[]; acc=[]; mats=[]; prims=[]
 for positions,normals,color in groups:
  pb=b"".join(struct.pack("<3f",*x) for x in positions); nb=b"".join(struct.pack("<3f",*x) for x in normals)
  po=len(binary); binary.extend(pb); no=len(binary); binary.extend(nb)
  pv=len(views); views.append({"buffer":0,"byteOffset":po,"byteLength":len(pb),"target":34962})
  nv=len(views); views.append({"buffer":0,"byteOffset":no,"byteLength":len(nb),"target":34962})
  ai=len(acc); lo=[min(x[i] for x in positions) for i in range(3)]; hi=[max(x[i] for x in positions) for i in range(3)]
  acc.append({"bufferView":pv,"componentType":5126,"count":len(positions),"type":"VEC3","min":lo,"max":hi}); ni=len(acc); acc.append({"bufferView":nv,"componentType":5126,"count":len(normals),"type":"VEC3"})
  mi=len(mats); mats.append({"pbrMetallicRoughness":{"baseColorFactor":color,"metallicFactor":0.0,"roughnessFactor":0.9}})
  prims.append({"attributes":{"POSITION":ai,"NORMAL":ni},"mode":4,"material":mi})
 while len(binary)%4: binary.append(0)
 doc={"asset":{"version":"2.0","generator":"TSM deterministic HLOD stitcher v1"},"scene":0,"scenes":[{"nodes":[0]}],
      "nodes":[{"mesh":0,"matrix":[1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1]}],
      "meshes":[{"primitives":prims}],"materials":mats,"buffers":[{"byteLength":len(binary)}],"bufferViews":views,"accessors":acc}
 j=json.dumps(doc,separators=(",",":")).encode(); j+=b" "*((4-len(j)%4)%4)
 return struct.pack("<4sII",b"glTF",2,12+8+len(j)+8+len(binary))+struct.pack("<I4s",len(j),b"JSON")+j+struct.pack("<I4s",len(binary),b"BIN\0")+binary

def main():
 ap=argparse.ArgumentParser(); ap.add_argument("--hlod",required=True,type=Path); ap.add_argument("--source-dir",required=True,type=Path); ap.add_argument("--out-dir",required=True,type=Path); a=ap.parse_args()
 ts=json.loads(a.hlod.read_text()); rt=ts["root"].get("transform")
 if not isinstance(rt,list) or len(rt)!=16: fail("HLOD root transform missing")
 a.out_dir.mkdir(parents=True,exist_ok=True); idx=0; sources=0
 def visit(n):
  nonlocal idx,sources
  ch=n.get("children",[])
  if not ch: return
  if all(isinstance(x,dict) and isinstance(x.get("content"),dict) for x in ch):
   groups={}
   for child in ch:
    uri=child["content"]["uri"]; doc,binary=read_glb(a.source_dir/uri); tr=child.get("transform")
    if not isinstance(tr,list) or len(tr)!=16: fail(f"building transform missing: {uri}")
    prim=doc.get("meshes",[{}])[0].get("primitives",[{}])[0]; attrs=prim.get("attributes",{})
    ps=pvals(doc,binary,attrs["POSITION"]); ns=pvals(doc,binary,attrs["NORMAL"])
    color=doc.get("materials",[{}])[0].get("pbrMetallicRoughness",{}).get("baseColorFactor",[.6,.57,.52,1])
    key=json.dumps(color,separators=(",",":")); groups.setdefault(key,([],[],color))
    gp,gn,_=groups[key]
    for p,nm in zip(ps,ns): gp.append(tp(tr,p)); gn.append(tn(tr,nm))
    sources+=1
   out=a.out_dir/f"leaf-{idx:04d}.glb"; out.write_bytes(make([groups[k] for k in sorted(groups)]))
   n.pop("children",None); n["content"]={"uri":out.name}; idx+=1; return
  for x in ch: visit(x)
 visit(ts["root"])
 manifest={"schemaVersion":"1.0.0","artifactId":"tsm-buildings-3d-tiles-hlod-stitched","authorityClass":"DERIVED","engineeringUse":False,"regulatoryUse":False,"leafCount":idx,"sourceBuildingCount":sources,"sourceHlodSha256":hashlib.sha256(a.hlod.read_bytes()).hexdigest(),"deterministic":True,"content":[f"leaf-{i:04d}.glb" for i in range(idx)]}
 (a.out_dir/"tileset.json").write_text(json.dumps(ts,indent=2)+"\n"); (a.out_dir/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
 paths=[a.out_dir/"tileset.json",a.out_dir/"manifest.json",*sorted(a.out_dir.glob("leaf-*.glb"))]
 (a.out_dir/"SHA256SUMS").write_text("".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in paths))
 print(json.dumps(manifest,sort_keys=True))
if __name__=="__main__": main()
