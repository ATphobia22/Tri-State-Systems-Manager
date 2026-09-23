#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..","..");
const required=["docs/ARCHITECTURE-CURRENT-STATE.md","data/schemas/tsm-four-plane-architecture-v1.json","data/schemas/tsm-data-contract-schema-v1.0.0.json","tsm-console/src/lib/data-fabric-registry.ts"];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
if(missing.length){console.error(JSON.stringify({ok:false,gate:"enterprise-data-architecture",missing},null,2));process.exit(1);}

console.log(JSON.stringify({ok:true,gate:"enterprise-data-architecture"},null,2));
