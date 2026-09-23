#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..",".."); const required=["tsm-native/config/agency-data-fabric-contract.json","tsm-native/config/data-fabric-contract.json","data/fabrics"];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
if(missing.length){console.error(JSON.stringify({ok:false,gate:"agency-data-fabric",missing},null,2));process.exit(1);}
JSON.parse(fs.readFileSync(path.join(root,required[0]),"utf8")); console.log(JSON.stringify({ok:true,gate:"agency-data-fabric",verifiedPaths:required},null,2));