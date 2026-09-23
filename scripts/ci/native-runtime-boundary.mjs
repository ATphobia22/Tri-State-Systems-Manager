#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..","..");
const required=["tsm-native/config/native-geospatial-runtime.json","tsm-native/config/sovereign-runtime-policy.json","tsm-native/TSMNative.uproject","native/archimedes/CMakeLists.txt"];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
if(missing.length){console.error(JSON.stringify({ok:false,gate:"native-runtime-boundary",missing},null,2));process.exit(1);}
const v=JSON.parse(fs.readFileSync(path.join(root,required[0]),"utf8")); const bad=["networkDataSources","browser","nodeJs","localhostServer","mutableRuntimeData"].filter(k=>v[k]===true); if(bad.length) process.exit(1);
console.log(JSON.stringify({ok:true,gate:"native-runtime-boundary"},null,2));
