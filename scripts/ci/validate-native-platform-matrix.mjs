#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..","..");
const p=path.join(root,"native/archimedes/CMakePresets.json"); const m=path.join(root,"tsm-native/config/platform-build-matrix.json");
if(!fs.existsSync(p)||!fs.existsSync(m)){console.error("Native platform contract files are missing.");process.exit(1);}
const presets=JSON.parse(fs.readFileSync(p,"utf8")); const matrix=JSON.parse(fs.readFileSync(m,"utf8"));
if(!Array.isArray(presets.configurePresets)||!Array.isArray(matrix.targets)){console.error("Native platform contracts have invalid schema.");process.exit(1);}
console.log(JSON.stringify({ok:true,gate:"native-platform-matrix",targets:matrix.targets.length,presets:presets.configurePresets.length},null,2));