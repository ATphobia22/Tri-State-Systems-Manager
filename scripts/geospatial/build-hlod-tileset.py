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
 def __init__(self,items,depth,max_items,max_depth,fallback_error,padding=0.5):
  self.items=sorted(items,key=lambda i:(i.center.x,i.center.y,i.center.z,i.sid if i.sid is not None else -1)); self.depth=depth; self.padding=padding
  # Internal ADD tiles carry no simplified geometry. Keep the source-root
  # fallback as a floor and preserve any larger declared descendant error.
  # A depth-based reduction would imply an accuracy improvement for which no
  # generalized parent geometry has been generated.
  if isinstance(fallback_error,bool) or not isinstance(fallback_error,(int,float)) or not math.isfinite(fallback_error) or fallback_error<0:
   raise ValueError(f"invalid fallback geometricError: {fallback_error!r}")
  errors=[]
  for item in self.items:
   value=item.tile.get("geometricError",fallback_error)
   if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or value<0:
    raise ValueError(f"invalid source tile geometricError: {value!r}")
   errors.append(float(value))
  self.geometric_error=max([float(fallback_error), *errors])
  self.lo=V(min(i.lo.x for i in items),min(i.lo.y for i in items),min(i.lo.z for i in items)); self.hi=V(max(i.hi.x for i in items),max(i.hi.y for i in items),max(i.hi.z for i in items)); self.children=[]
  if len(items)>max_items and depth<max_depth:
   # A horizontal XY-only split collapses when sources lie on a narrow
   # vertical/ECEF-aligned axis. Split along the two locally widest ENU axes,
   # retaining original 3D OBBs, and never manufacture empty child geometry.
   ranges=[self.hi.x-self.lo.x,self.hi.y-self.lo.y,self.hi.z-self.lo.z]
   first,second=sorted(range(3),key=lambda k:(-ranges[k],k))[:2]
   names=("x","y","z")
   mids=[(getattr(self.lo,n)+getattr(self.hi,n))/2 for n in names]
   groups=[[] for _ in range(4)]
   for item in self.items:
    a=1 if getattr(item.center,names[first])>=mids[first] else 0
    b=1 if getattr(item.center,names[second])>=mids[second] else 0
    groups[b*2+a].append(item)
   if sum(bool(group) for group in groups)>1:
    self.children=[Q(x,depth+1,max_items,max_depth,self.geometric_error,padding) for x in groups if x]
 def tile(self,ge):
  r={"boundingVolume":{"box":box(self.lo,self.hi,self.padding)},"geometricError":self.geometric_error,"refine":"ADD"}
  r["children"]=[x.tile(ge) for x in self.children] if self.children else [i.tile for i in self.items]; return r
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("--input",required=True,type=Path); ap.add_argument("--output",required=True,type=Path); ap.add_argument("--max-items",type=int); ap.add_argument("--max-depth",type=int); ap.add_argument("--config",type=Path); a=ap.parse_args()
 cfg=json.loads(a.config.read_text()) if a.config else {}
 if a.config and (not isinstance(cfg,dict) or cfg.get("schema")!="tsm.hlod.quadtree.v1"):
  ap.error("invalid HLOD configuration schema")
 a.max_items=cfg.get("maxItemsPerLeaf",50) if a.max_items is None else a.max_items
 a.max_depth=cfg.get("maxDepth",6) if a.max_depth is None else a.max_depth
 padding=cfg.get("boundsPaddingMeters",0.5)
 if isinstance(padding,bool) or not isinstance(padding,(int,float)) or not math.isfinite(padding) or padding<0 or padding>100: raise SystemExit("invalid bounds padding")
 if type(a.max_items) is not int or type(a.max_depth) is not int or a.max_items<1 or not 0<=a.max_depth<=32:
  ap.error("invalid HLOD limits")
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
 raw_source_root_error=ts["root"].get("geometricError",1)
 if isinstance(raw_source_root_error,bool) or not isinstance(raw_source_root_error,(int,float)) or not math.isfinite(raw_source_root_error) or raw_source_root_error<0:
  raise SystemExit("invalid source root geometricError")
 source_root_error=float(raw_source_root_error)
 ge=max(source_root_error,1)
 q=Q(items,0,a.max_items,a.max_depth,ge,padding); nr=q.tile(ge); nr["transform"]=rt
 ge=max(ge,q.geometric_error)
 out={"asset":ts["asset"],"geometricError":ge,"root":nr,"extras":{"tsm":{"hlod":True,"partition":"quadtree-ecef-derived-enu","maxItemsPerLeaf":a.max_items,"maxDepth":a.max_depth,"boundsPaddingMeters":padding,"leafCountTarget":"derived","geometricErrorPolicy":"contentless-nodes-inherit-parent-error-floor-v1","geometricErrorInterpretation":"conservative traversal proxy on empty partition nodes; not measured mesh-simplification error"}}}
 a.output.parent.mkdir(parents=True,exist_ok=True); a.output.write_text(json.dumps(out,separators=(",",":"))+"\n")
 print(json.dumps({"buildings":len(items),"rootFrame":"ENU@ECEF-centroid","output":str(a.output)}))
if __name__=="__main__":main()
