#!/usr/bin/env node
/**
 * Exact-county GeoJSON validator.
 *
 * Policy:
 * - NEVER uses a bounding box as an acceptance test.
 * - "within" requires every source vertex to be inside the exact county
 *   polygon and no source segment to cross the county boundary.
 * - "intersects" requires a source vertex inside, a county vertex inside
 *   the source geometry, or a segment intersection.
 *
 * This is intentionally dependency-free so the offline verifier can run on
 * the Windows/Linux bundles without a GIS runtime.
 */
import fs from "node:fs";
import path from "node:path";

const EPS = 1e-10;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function ringClosed(ring) {
  if (ring.length < 4) return ring;
  const a = ring[0], b = ring[ring.length - 1];
  return Math.abs(a[0]-b[0]) < EPS && Math.abs(a[1]-b[1]) < EPS ? ring : [...ring, ring[0]];
}

function orient(a,b,c) {
  return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
}

function onSegment(a,b,p) {
  return Math.abs(orient(a,b,p)) <= EPS &&
    p[0] >= Math.min(a[0],b[0])-EPS && p[0] <= Math.max(a[0],b[0])+EPS &&
    p[1] >= Math.min(a[1],b[1])-EPS && p[1] <= Math.max(a[1],b[1])+EPS;
}

function segmentsIntersect(a,b,c,d) {
  const o1=orient(a,b,c), o2=orient(a,b,d), o3=orient(c,d,a), o4=orient(c,d,b);
  if (((o1>EPS && o2<-EPS)||(o1<-EPS && o2>EPS)) &&
      ((o3>EPS && o4<-EPS)||(o3<-EPS && o4>EPS))) return true;
  return onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}

function pointInRing(point, ring) {
  let inside=false;
  const r=ringClosed(ring);
  for(let i=0,j=r.length-1;i<r.length;j=i++){
    const a=r[i], b=r[j];
    if(onSegment(a,b,point)) return true;
    const hit=((a[1]>point[1]) !== (b[1]>point[1])) &&
      point[0] < (b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0];
    if(hit) inside=!inside;
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  if(!pointInRing(point,polygon[0])) return false;
  for(let i=1;i<polygon.length;i++) if(pointInRing(point,polygon[i])) return false;
  return true;
}

function normalizePolygons(geometry) {
  if(geometry.type==="Polygon") return [geometry.coordinates];
  if(geometry.type==="MultiPolygon") return geometry.coordinates;
  return [];
}

function pointInGeometry(point, geometry) {
  return normalizePolygons(geometry).some(p=>pointInPolygon(point,p));
}

function geometrySegments(geometry) {
  const out=[];
  const polys=normalizePolygons(geometry);
  for(const poly of polys) for(const ring0 of poly) {
    const ring=ringClosed(ring0);
    for(let i=1;i<ring.length;i++) out.push([ring[i-1],ring[i]]);
  }
  if(geometry.type==="LineString"){
    for(let i=1;i<geometry.coordinates.length;i++) out.push([geometry.coordinates[i-1],geometry.coordinates[i]]);
  } else if(geometry.type==="MultiLineString"){
    for(const line of geometry.coordinates) for(let i=1;i<line.length;i++) out.push([line[i-1],line[i]]);
  }
  return out;
}

function geometryVertices(geometry) {
  const out=[];
  const visit=(coords)=>{
    if(!Array.isArray(coords)) return;
    if(coords.length>=2 && typeof coords[0]==="number") out.push(coords);
    else for(const c of coords) visit(c);
  };
  visit(geometry.coordinates);
  return out;
}

function intersectsGeometry(source, county) {
  const countyVertices=geometryVertices(county);
  const sourceVertices=geometryVertices(source);
  if(sourceVertices.some(p=>pointInGeometry(p,county))) return true;
  if(countyVertices.some(p=>pointInGeometry(p,source))) return true;
  const a=geometrySegments(source), b=geometrySegments(county);
  return a.some(sa=>b.some(sb=>segmentsIntersect(sa[0],sa[1],sb[0],sb[1])));
}

function withinGeometry(source, county) {
  const vertices=geometryVertices(source);
  if(vertices.length===0) return false;
  if(!vertices.every(p=>pointInGeometry(p,county))) return false;
  const sourceSegs=geometrySegments(source), countySegs=geometrySegments(county);
  return !sourceSegs.some(sa=>countySegs.some(sb=>segmentsIntersect(sa[0],sa[1],sb[0],sb[1])));
}

function eachGeometry(gj) {
  if(gj.type==="FeatureCollection") return gj.features.flatMap(eachGeometry);
  if(gj.type==="Feature") return gj.geometry ? [gj.geometry] : [];
  if(gj.type==="GeometryCollection") return gj.geometries.flatMap(eachGeometry);
  return [gj];
}

function main() {
  const [boundaryFile, sourceFile, relation="within"] = process.argv.slice(2);
  if(!boundaryFile || !sourceFile) throw new Error("Usage: validate-exact-county.mjs <boundary.geojson> <source.geojson> [within|intersects]");
  if(!["within","intersects"].includes(relation)) throw new Error("Relation must be within or intersects");
  const boundary=readJson(boundaryFile);
  const countyGeometries=eachGeometry(boundary);
  if(countyGeometries.length!==1) throw new Error("Boundary must contain exactly one county geometry");
  const source=readJson(sourceFile);
  const geometries=eachGeometry(source);
  if(geometries.length===0) throw new Error("Source contains no geometries");
  const test=relation==="within" ? withinGeometry : intersectsGeometry;
  const failures=[];
  for(let i=0;i<geometries.length;i++){
    if(!test(geometries[i],countyGeometries[0])) failures.push(i);
  }
  const result={
    schema:"tsm-exact-county-spatial-validation-v1",
    boundary:path.basename(boundaryFile),
    source:path.basename(sourceFile),
    relation,
    featureCount:geometries.length,
    validatedFeatureCount:geometries.length-failures.length,
    failedFeatureIndexes:failures,
    status:failures.length===0 ? "validated" : "failed"
  };
  console.log(JSON.stringify(result,null,2));
  if(failures.length) process.exit(2);
}
main();
