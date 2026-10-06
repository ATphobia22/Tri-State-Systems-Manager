#!/usr/bin/env python3
"""Build a spatially coherent deterministic 3D Tiles 1.1 HLOD quadtree."""
from __future__ import annotations
import argparse,json,math
from dataclasses import dataclass
from pathlib import Path

@dataclass(frozen=True)
class V: x:float; y:float; z:float
def mm(a,b): return [sum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]
def inv(m):
 t=V(m[12],m[13],m[14])
 return [m[0],m[4],m[8],0,m[1],m[5],m[9],0,m[2],m[6],m[10],0,
 -(m[0]*t.x+m[1]*t.y+m[2]*t.z),-(m[4]*t.x+m[5]*t.y+m[6]*t.z),-(m[8]*t.x+m[9]*t.y+m[10]*t.z),1]
def pt(m,p): return V(m[0]*p.x+m[4]*p.y+m[8]*p.z+m[12],m[1]*p.x+m[5]*p.y+m[9]*p.z+m[13],m[2]*p.x+m[6]*p.y+m[10]*p.z+m[14])
def sub(a,b): return V(a.x-b.x,a.y-b.y,a.z-b.z)
def dot(a,b): return a.x*b.x+a.y*b.y+a.z*b.z
def axes(o):
 lon=math.atan2(o.y,o.x); lat=math.atan2(o.z,math.hypot(o.x,o.y))
 return (V(-math.sin(lon),math.cos(lon),0),V(-math.sin(lat)*math.cos(lon),-math.sin(lat)*math.sin(lon),math.cos(lat)),V(math.cos(lat)*math.cos(lon),math.cos(lat)*math.sin(lon),math.sin(lat)))
def project(p,o,a):
 d=sub(p,o); return V(dot(d,a[0]),dot(d,a[1]),dot(d,a[2]))
def matrix(o,a):
 e,n,u=a; return [e.x,e.y,e.z,0,n.x,n.y,n.z,0,u.x,u.y,u.z,0,o.x,o.y,o.z,1]
def corners(b):
 c=V(*b[:3]); a=V(*b[3:6]); d=V(*b[6:9]); e=V(*b[9:12])
 return [V(c.x+sx*a.x+sy*d.x+sz*e.x,c.y+sx*a.y+sy*d.y+sz*e.y,c.z+sx*a.z+sy*d.z+sz*e.z) for sx in(-1,1) for sy in(-1,1) for sz in(-1,1)]
def box(lo,hi,p=.5):
 lo=V(lo.x-p,lo.y-p,lo.z-p); hi=V(hi.x+p,hi.y+p,hi.z+p); c=V((lo.x+hi.x)/2,(lo.y+hi.y)/2,(lo.z+hi.z)/2)
 return [c.x,c.y,c.z,max((hi.x-lo.x)/2,.01),0,0,0,max((hi.y-lo.y)/2,.01),0,0,0,max((hi.z-lo.z)/2,.01)]
@dataclass(frozen=True)
class Item: tile:dict; sid:int|None; center:V; lo:V; hi:V
class Q:
 def __init__(self,items,depth,max_items,max_depth):
  self.items=sorted(items,key=lambda i:(i.center.x,i.center.y,i.center.z,i.sid if i.sid is not None else -1)); self.depth=depth
  self.lo=V(min(i.lo.x for i in items),min(i.lo.y for i in items),min(i.lo.z for i in items)); self.hi=V(max(i.hi.x for i in items),max(i.hi.y for i in items),max(i.hi.z for i in items)); self.children=[]
  if len(items)>max_items and depth<max_depth:
   mx=(self.lo.x+self.hi.x)/2; my=(self.lo.y+self.hi.y)/2; q=[[] for _ in range(4)]
   for i in self.items:q[(0 if i.center.y<my else 1)*2+(0 if i.center.x<mx else 1)].append(i)
   self.children=[Q(x,depth+1,max_items,max_depth) for x in q if x]
 def tile(self,ge):
  r={"boundingVolume":{"box":box(self.lo,self.hi)},"geometricError":ge/(2**self.depth),"refine":"ADD"}
  r["children"]=[x.tile(ge) for x in self.children] if self.children else [i.tile for i in self.items]; return r
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("--input",required=True,type=Path); ap.add_argument("--output",required=True,type=Path); ap.add_argument("--max-items",type=int,default=50); ap.add_argument("--max-depth",type=int,default=6); a=ap.parse_args()
 if a.max_items<1 or a.max_depth<0: raise SystemExit("invalid HLOD limits")
 ts=json.loads(a.input.read_text()); children=ts.get("root",{}).get("children")
 if not isinstance(children,list) or not children: raise SystemExit("flat tileset has no children")
 centers=[]
 for t in children:
  tr=t.get("transform",[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); cs=[pt(tr,p) for p in corners(t["boundingVolume"]["box"])]
  centers.append(V(sum(p.x for p in cs)/8,sum(p.y for p in cs)/8,sum(p.z for p in cs)/8))
 origin=V(sum(p.x for p in centers)/len(centers),sum(p.y for p in centers)/len(centers),sum(p.z for p in centers)/len(centers)); ax=axes(origin); rt=matrix(origin,ax); ri=inv(rt)
 items=[]
 for t in children:
  tr=t.get("transform",[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); ps=[project(pt(tr,p),origin,ax) for p in corners(t["boundingVolume"]["box"])]
  lo=V(min(p.x for p in ps),min(p.y for p in ps),min(p.z for p in ps)); hi=V(max(p.x for p in ps),max(p.y for p in ps),max(p.z for p in ps))
  tc=json.loads(json.dumps(t))
  if isinstance(tc.get("transform"),list): tc["transform"]=mm(ri,tc["transform"])
  sid=tc.get("extras",{}).get("tsm",{}).get("sourceObjectId"); items.append(Item(tc,sid,V((lo.x+hi.x)/2,(lo.y+hi.y)/2,(lo.z+hi.z)/2),lo,hi))
 ge=max(float(ts["root"].get("geometricError",1)),1); q=Q(items,0,a.max_items,a.max_depth); nr=q.tile(ge); nr["transform"]=rt
 out={"asset":ts["asset"],"geometricError":ge,"root":nr,"extras":{"tsm":{"hlod":True,"partition":"quadtree-ecef-derived-enu","maxItemsPerLeaf":a.max_items,"maxDepth":a.max_depth,"leafCountTarget":"derived"}}}
 a.output.parent.mkdir(parents=True,exist_ok=True); a.output.write_text(json.dumps(out,separators=(",",":"))+"\n")
 print(json.dumps({"buildings":len(items),"rootFrame":"ENU@ECEF-centroid","output":str(a.output)}))
if __name__=="__main__":main()
