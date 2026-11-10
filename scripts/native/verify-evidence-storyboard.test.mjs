#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { verifyStoryboard } from "./verify-evidence-storyboard.mjs";

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tsm-storyboard-"));
  const source = path.join(dir, "source.geojson");
  fs.writeFileSync(source, JSON.stringify({
    type:"FeatureCollection",features:[] // Synthetic test fixture; not a real engineering source.
  }));
  const sha = crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex");
  const board = {
    schema:"tsm.native.evidence-storyboard.v1",storyboardId:"demo",
    state:"REVIEW_REQUIRED_NOT_RENDERED",regulatoryDetermination:false,
    modelOutputAltered:false,notice:"Unverified synthetic test",shots:[{
      shotId:"intro",title:"Synthetic source",narrative:"Fixture only",
      sourceId:"synthetic",sourceSha256:sha,authorityClass:"CONTEXT",
      acquisitionUtc:"2026-11-10T00:00:00Z",cinematicOnly:false,
      sourceContentVerifiedByThisOperation:false,agencyApproved:false
    }]
  };
  const catalog = {
    schema:"tsm.native.reviewed-source-catalog.v1",sources:[{
      sourceId:"synthetic",relativePath:"source.geojson",sha256:sha,
      authorityClass:"CONTEXT",acquisitionUtc:"2026-11-10T00:00:00Z",
      horizontalCrs:"EPSG:4326",verticalDatum:"NONE_2D",
      approvedForDisplay:true,licenseReviewed:true
    }]
  };
  const storyboard = path.join(dir,"storyboard.json");
  const registry = path.join(dir,"catalog.json");
  const save = () => {
    fs.writeFileSync(storyboard,JSON.stringify(board));
    fs.writeFileSync(registry,JSON.stringify(catalog));
  };
  save();
  return {dir,source,board,catalog,storyboard,registry,save,
    verify:()=>verifyStoryboard({storyboard,catalog:registry,dataRoot:dir})};
}

test("local source is physically hashed and no film/engineering proof is inferred",t=>{
  const f=fixture();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
  const result=f.verify();
  assert.equal(result.uniqueSourceFilesVerified,1);
  assert.equal(result.shots[0].classification,"LOCAL_SOURCE_BYTES_VERIFIED_REVIEW_PENDING");
  assert.equal(result.engineeringCertified,false);
  assert.equal(result.renderedFilmVerified,false);
  assert.equal(result.offlineWindowsShippingVerified,false);
});

test("tampering changes file bytes and is rejected",t=>{
  const f=fixture();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
  fs.appendFileSync(f.source,"\nextra bytes");
  assert.throws(()=>f.verify(),/SHA-256 mismatch/);
});

test("missing human license approval or promoted authority is rejected",t=>{
  const f=fixture();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
  f.catalog.sources[0].licenseReviewed=false;f.save();
  assert.throws(()=>f.verify(),/approval\/license/);
  f.catalog.sources[0].licenseReviewed=true;
  f.board.shots[0].authorityClass="REGULATORY_REFERENCE";f.save();
  assert.throws(()=>f.verify(),/authority promotion/);
});

test("source path traversal and symlinks cannot leave local approved directory",t=>{
  const f=fixture();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
  f.catalog.sources[0].relativePath="../outside.geojson";f.save();
  assert.throws(()=>f.verify(),/traversal forbidden/);
  fs.symlinkSync(f.source,path.join(f.dir,"linked.geojson"));
  f.catalog.sources[0].relativePath="linked.geojson";f.save();
  assert.throws(()=>f.verify(),/Symlinked evidence forbidden/);
});

test("cinematic-only shots are not credited as observations",t=>{
  const f=fixture();t.after(()=>fs.rmSync(f.dir,{recursive:true,force:true}));
  f.board.shots[0]={
    shotId:"artistic",title:"Illustrative river",narrative:"No data claims",
    sourceId:"",sourceSha256:"",authorityClass:"",acquisitionUtc:"",
    cinematicOnly:true,sourceContentVerifiedByThisOperation:false,agencyApproved:false
  };
  f.save();const result=f.verify();
  assert.equal(result.uniqueSourceFilesVerified,0);
  assert.equal(result.shots[0].classification,"CINEMATIC_ONLY_NOT_OBSERVED");
});
