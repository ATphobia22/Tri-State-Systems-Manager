#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..","..");
const required=["docs/ARCHITECTURE-CURRENT-STATE.md","docs/architecture","docs/OPEN-WORLD-DIGITAL-TWIN-ARCHITECTURE.md","data/schemas/tsm-four-plane-architecture-v1.json"];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
if(missing.length){console.error(JSON.stringify({ok:false,gate:"architecture-repository",missing},null,2));process.exit(1);}
console.log(JSON.stringify({ok:true,gate:"architecture-repository",verifiedPaths:required},null,2));