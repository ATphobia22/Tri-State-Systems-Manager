#!/usr/bin/env python3
"""Build a deterministic, spatially coherent OGC 3D Tiles 1.1 HLOD quadtree."""
from __future__ import annotations
import argparse, hashlib, json, math
from dataclasses import dataclass
from pathlib import Path

@dataclass(frozen=True)
class V:
    x: float
    y: float
    z: float

def mm(a, b):
    return [sum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]

def inv_rigid(m):
    tx,ty,tz=m[12],m[13],m[14]
    return [m[0],m[4],m[8],0,m[1],m[5],m[9],0,m[2],m[6],m[10],0,
            -(m[0]*tx+m[1]*ty+m[2]*tz),-(m[4]*tx+m[5]*ty+m[6]*tz),-(m[8]*tx+m[9]*ty+m[10]*tz),1]

def point(m,p):
    return V(m[0]*p.x+m[4]*p.y+m[8]*p.z+m[12],
             m[1]*p.x+m[5]*p.y+m[9]*p.z+m[13],
             m[2]*p.x+m[6]*p.y+m[10]*p.z+m[14])

def sub(a,b): return V(a.x-b.x,a.y-b.y,a.z-b.z)
def dot(a,b): return a.x*b.x+a.y*b.y+a.z*b.z

def ecef_enu(o):
    lon=math.atan2(o.y,o.x); lat=math.atan2(o.z,math.hypot(o.x,o.y))
    return (V(-math.sin(lon),math.cos(lon),0),
            V(-math.sin(lat)*math.cos(lon),-math.sin(lat)*math.sin(lon),math.cos(lat)),
            V(math.cos(lat)*math.cos(lon),math.cos(lat)*math.sin(lon),math.sin(lat)))

def enu_matrix(o,a):
    e,n,u=a
    return [e.x,e.y,e.z,0,n.x,n.y,n.z,0,u.x,u.y,u.z,0,o.x,o.y,o.z,1]

def project(p,o,a):
    d=sub(p,o); return V(dot(d,a[0]),dot(d,a[1]),dot(d,a[2]))

def corners(box):
    c=V(*box[:3]); a=V(*box[3:6]); b=V(*box[6:9]); d=V(*box[9:12])
    return [V(c.x+sx*a.x+sy*b.x+sz*d.x,c.y+sx*a.y+sy*b.y+sz*d.y,c.z+sx*a.z+sy*b.z+sz*d.z)
            for sx in (-1,1) for sy in (-1,1) for sz in (-1,1)]

def box12(lo,hi,pad=.5):
    lo=V(lo.x-pad,lo.y-pad,lo.z-pad); hi=V(hi.x+pad,hi.y+pad,hi.z+pad)
    c=V((lo.x+hi.x)/2,(lo.y+hi.y)/2,(lo.z+hi.z)/2)
    return [c.x,c.y,c.z,max((hi.x-lo.x)/2,.01),0,0,0,max((hi.y-lo.y)/2,.01),0,0,0,max((hi.z-lo.z)/2,.01)]

@dataclass(frozen=True)
class Item:
    tile: dict
    sid: int|None
    center: V
    lo: V
    hi: V

class Node:
    def __init__(self,items,depth,max_items,max_depth):
        self.items=sorted(items,key=lambda i:(i.center.x,i.center.y,i.center.z,i.sid if i.sid is not None else -1))
        self.depth=depth
        self.lo=V(min(i.lo.x for i in items),min(i.lo.y for i in items),min(i.lo.z for i in items))
        self.hi=V(max(i.hi.x for i in items),max(i.hi.y for i in items),max(i.hi.z for i in items))
        self.children=[]
        if len(items)>max_items and depth<max_depth:
            mx=(self.lo.x+self.hi.x)/2; my=(self.lo.y+self.hi.y)/2; q=[[] for _ in range(4)]
            for i in self.items: q[(0 if i.center.y<my else 1)*2+(0 if i.center.x<mx else 1)].append(i)
            self.children=[Node(x,depth+1,max_items,max_depth) for x in q if x]
    def json(self,ge):
        r={"boundingVolume":{"box":box12(self.lo,self.hi)},"geometricError":ge/(2**self.depth),"refine":"ADD"}
        r["children"]=[c.json(ge) for c in self.children] if self.children else [i.tile for i in self.items]
        return r

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--input",required=True,type=Path); ap.add_argument("--output",required=True,type=Path)
    ap.add_argument("--max-items",type=int,default=50); ap.add_argument("--max-depth",type=int,default=6); a=ap.parse_args()
    if a.max_items<1 or a.max_depth<0: raise SystemExit("invalid HLOD limits")
    ts=json.loads(a.input.read_text()); children=ts["root"].get("children")
    if not isinstance(children,list) or not children: raise SystemExit("flat tileset has no children")
    ec=[]
    for t in children:
        if not isinstance(t,dict) or not isinstance(t.get("boundingVolume",{}).get("box"),list): raise SystemExit("building child lacks box")
        tr=t.get("transform",[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])
        ec.append(V(*(sum((point(tr,p).__dict__[k] for p in corners(t["boundingVolume"]["box"])),0)/8 for k in ("x","y","z"))))
    origin=V(sum(x.x for x in ec)/len(ec),sum(x.y for x in ec)/len(ec),sum(x.z for x in ec)/len(ec))
    axes=ecef_enu(origin); root_tr=enu_matrix(origin,axes); root_inv=inv_rigid(root_tr)
    items=[]
    for t in children:
        tr=t.get("transform",[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])
        pts=[project(point(tr,p),origin,axes) for p in corners(t["boundingVolume"]["box"])]
        lo=V(min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)); hi=V(max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts))
        tc=json.loads(json.dumps(t))
        if isinstance(tc.get("transform"),list): tc["transform"]=mm(root_inv,tc["transform"])
        sid=tc.get("extras",{}).get("tsm",{}).get("sourceObjectId")
        items.append(Item(tc,sid,V((lo.x+hi.x)/2,(lo.y+hi.y)/2,(lo.z+hi.z)/2),lo,hi))
    root=Node(items,0,a.max_items,a.max_depth); ge=max(float(ts["root"]["geometricError"]),1.0)
    new=dict(asset=ts["asset"],geometricError=ge,root=root.json(ge),extras={"tsm":{"hlod":True,"partition":"quadtree-ecef-derived-enu","maxItemsPerLeaf":a.max_items,"maxDepth":a.max_depth,"leafCountTarget":"derived"}})
    new["root"]["transform"]=root_tr; a.output.parent.mkdir(parents=True,exist_ok=True); a.output.write_text(json.dumps(new,separators=(",",":"))+"\n")
    srcman=a.input.parent/"manifest.json"
    if not srcman.is_file(): raise SystemExit("input manifest.json is required")
    m=json.loads(srcman.read_text()); m.update(artifactId="tsm-buildings-3d-tiles-hlod",stage="hlod",buildingCount=len(items),maxItemsPerLeaf=a.max_items,maxDepth=a.max_depth,content=sorted(i.tile["content"]["uri"] for i in items),deterministic=True)
    (a.output.parent/"manifest.json").write_text(json.dumps(m,indent=2)+"\n")
    paths=[a.output,a.output.parent/"manifest.json",*sorted(a.output.parent.glob("*.glb"))]
    (a.output.parent/"SHA256SUMS").write_text("".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in paths))
    def leaves(n): return sum(leaves(c) for c in n.children) if n.children else 1
    print(json.dumps({"buildings":len(items),"leaves":leaves(root),"rootFrame":"ENU@ECEF-centroid","output":str(a.output)}))
if __name__=="__main__": main()
