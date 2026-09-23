#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..","..");
const matrix=path.join(root,"tsm-native/config/platform-build-matrix.json");
const presets=path.join(root,"native/archimedes/CMakePresets.json");
if(!fs.existsSync(matrix)||!fs.existsSync(presets)){console.error(JSON.stringify({ok:false,gate:"native-platform-matrix",missing:[!fs.existsSync(matrix)&&"tsm-native/config/platform-build-matrix.json",!fs.existsSync(presets)&&"native/archimedes/CMakePresets.json"].filter(Boolean)},null,2));process.exit(1);}
const m=JSON.parse(fs.readFileSync(matrix,"utf8")); const p=JSON.parse(fs.readFileSync(presets,"utf8"));
if(!Array.isArray(m.platforms)||!p.configurePresets?.length){console.error("Native platform matrix is incomplete.");process.exit(1);}
console.log(JSON.stringify({ok:true,gate:"native-platform-matrix",platforms:m.platforms.length,presets:p.configurePresets.length},null,2));