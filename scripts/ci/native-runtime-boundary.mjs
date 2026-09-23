#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..",".."); const files=["tsm-native/config/native-geospatial-runtime.json","tsm-native/config/sovereign-runtime-policy.json","tsm-native/TSMNative.uproject","native/archimedes/CMakeLists.txt"];
const missing=files.filter(p=>!fs.existsSync(path.join(root,p)));
if(missing.length){console.error(JSON.stringify({ok:false,gate:"native-runtime-boundary",missing},null,2));process.exit(1);}
const runtime=JSON.parse(fs.readFileSync(path.join(root,files[0]),"utf8")); const forbidden=Object.entries(runtime).filter(([k,v])=>["networkDataSources","browser","nodeJs","localhostServer","mutableRuntimeData"].includes(k)&&v===true).map(([k])=>k);
if(forbidden.length){console.error(JSON.stringify({ok:false,gate:"native-runtime-boundary",forbidden},null,2));process.exit(1);}
console.log(JSON.stringify({ok:true,gate:"native-runtime-boundary",sovereignRuntime:true},null,2));