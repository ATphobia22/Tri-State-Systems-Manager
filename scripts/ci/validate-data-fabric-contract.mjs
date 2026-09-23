#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..","..");
const required=["data/fabrics","data/fabrics/live/tsm-live-hydrology-fabric-v1.json","data/engineering/evidence-pipeline-contract.json","tsm-console/src/lib/data-fabric-registry.ts","tsm-console/tests/data-fabric-contract.test.mjs"];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
if(missing.length){console.error(JSON.stringify({ok:false,gate:"data-fabric-contract",missing},null,2));process.exit(1);}

console.log(JSON.stringify({ok:true,gate:"data-fabric-contract"},null,2));
