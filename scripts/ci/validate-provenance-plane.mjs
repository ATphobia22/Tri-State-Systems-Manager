#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..","..");
const required=["backend/evidence/bfe_provenance.py","backend/geospatial/temporal_provenance.py","tsm-console/server/ingestion/data-fabric-provenance.mjs","tsm-console/server/ingestion/data-fabric-provenance.test.mjs","data/engineering/evidence-pipeline-contract.json","tsm-native/config/provenance-plane-contract.json"];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
if(missing.length){console.error(JSON.stringify({ok:false,gate:"provenance-plane",missing},null,2));process.exit(1);}
console.log(JSON.stringify({ok:true,gate:"provenance-plane",verifiedFiles:required},null,2));