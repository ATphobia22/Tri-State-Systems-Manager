#!/usr/bin/env python3
"""Real raster-to-production Transvoxel seam acceptance adapter.

USES existing dem_to_transvoxel and transvoxel_transition_mesh modules.
Does not claim vertical-datum certification, completed terrain, or headed GPU evidence.
For local verified-source copies:
  TSM_DEM_VERTICAL_UNIT=us-ft python scripts/geospatial/mount_vernon_dem_transvoxel_gate.py \
    --raster ./IN2020_26850945_12.tiff --expected-sha256 HASH \
    --out ./out/real-transition-seam.json --acknowledge-preview-only
"""
from __future__ import annotations
import argparse,hashlib,importlib.util,json,math,os,sys,time
from pathlib import Path
import numpy as np

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from dem_to_transvoxel import load_dem_window,make_height_sampler
from transvoxel_transition_mesh import mesh_transition_cell

def digest(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()

def run(raster,expected_hash,window_x=600,window_y=600,window_size=128):
 raster=Path(raster)
 actual=digest(raster)
 if actual.lower()!=expected_hash.lower():raise ValueError('source raster SHA-256 mismatch')
 if os.environ.get('TSM_DEM_VERTICAL_UNIT')!='us-ft':
  raise ValueError('this visual-preview-only run requires explicit TSM_DEM_VERTICAL_UNIT=us-ft; source metadata has NOT independently verified vertical units')
 dem,px=load_dem_window(str(raster),window_x,window_y,window_size)
 sampler=make_height_sampler(dem,px)
 cell_extent=px*20.0
 if 2*cell_extent>(window_size-2)*px:raise ValueError('window too small for two cells')
 base=float(np.median(dem))
 height=lambda x,y:float(sampler(x,y))
 sdf=lambda x,y,z:float(z-height(x,y))
 origin=(px*2,px*2,base-cell_extent/2)
 t0=time.perf_counter()
 a,ta,ma=mesh_transition_cell(sdf,origin,0,cell_extent)
 adjacent=(origin[0],origin[1]+cell_extent,origin[2])
 b,tb,mb=mesh_transition_cell(sdf,adjacent,0,cell_extent)
 spec=importlib.util.spec_from_file_location('tsm_real_dem_benchmark',HERE/'benchmark-real-dem-transvoxel.py')
 module=importlib.util.module_from_spec(spec)
 spec.loader.exec_module(module)
 seam_plane=origin[1]+cell_extent
 e1=module._seam_intersection_key(a,ta,axis=1,coordinate=seam_plane)
 e2=module._seam_intersection_key(b,tb,axis=1,coordinate=seam_plane)
 elapsed=(time.perf_counter()-t0)*1000
 return {
  'schema':'tsm.real-dem-production-transvoxel.v1',
  'source':raster.name,'sha256':actual,'crs':'EPSG:2968',
  'verticalUnits':'UNVERIFIED_SOURCE_ASSUMED_US_FT_PREVIEW',
  'verticalDatum':'PENDING_EVIDENCE',
  'regulatoryStatus':'NOT_A_REGULATORY_DETERMINATION',
  'meshPipeline':'scripts/geospatial/transvoxel_transition_mesh.py',
  'windowPixels':[window_x,window_y,window_size],
  'pixelMeters':px,'cellExtentMeters':cell_extent,
  'cases':[ma,mb],'transitionTriangleCount':len(ta)+len(tb),
  'sharedPlaneIntersectionLeft':list(e1),'sharedPlaneIntersectionRight':list(e2),
  'sharedPlaneMatches':e1==e2,'meshingWallMilliseconds':elapsed,
  'scope':'one adjacent transition-cell pair, not countywide 3D octree',
  'cameraPanValidated':False,'mixedLODChunkTopologyValidated':False,
  'headedGPUValidated':False,'engineeringApproved':False
 }

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--raster',required=True)
 ap.add_argument('--expected-sha256',required=True)
 ap.add_argument('--out',required=True)
 ap.add_argument('--window-x',type=int,default=600)
 ap.add_argument('--window-y',type=int,default=600)
 ap.add_argument('--window-size',type=int,default=128)
 ap.add_argument('--acknowledge-preview-only',action='store_true')
 a=ap.parse_args()
 if not a.acknowledge_preview_only:ap.error('supply --acknowledge-preview-only; vertical datum/units are unverified')
 if len(a.expected_sha256)!=64 or any(c not in '0123456789abcdefABCDEF' for c in a.expected_sha256):
  ap.error('--expected-sha256 requires a 64-character hex digest')
 report=run(a.raster,a.expected_sha256,a.window_x,a.window_y,a.window_size)
 out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({k:report[k] for k in ['source','sharedPlaneMatches','transitionTriangleCount','cameraPanValidated','headedGPUValidated']},indent=2))
 if not report['sharedPlaneMatches']:raise SystemExit(2)

if __name__=='__main__':main()
