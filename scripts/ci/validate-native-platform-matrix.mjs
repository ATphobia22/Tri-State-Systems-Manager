#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..",".."); const value=JSON.parse(fs.readFileSync(path.join(root,"tsm-native/config/platform-build-matrix.json"),"utf8"));
const required=["Windows","macOS","iOS","iPadOS","Android","Linux"]; const actual=Array.isArray(value.targets)?value.targets.map(x=>x.platform):[]; const missing=required.filter(x=>!actual.includes(x));
if(missing.length){console.error(JSON.stringify({ok:false,gate:"native-platform-matrix",missing},null,2));process.exit(1);}
console.log(JSON.stringify({ok:true,gate:"native-platform-matrix",platforms:actual},null,2));