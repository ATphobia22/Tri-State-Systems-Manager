#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..","..");
const required=["tsm-native/config/runner-capability-contract.json","tsm-native/config/sovereign-runtime-policy.json","tsm-native/config/native-geospatial-runtime.json"];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
if(missing.length){console.error(JSON.stringify({ok:false,gate:"native-runtime-boundary",missing},null,2));process.exit(1);}
console.log(JSON.stringify({ok:true,gate:"native-runtime-boundary",verifiedFiles:required},null,2));