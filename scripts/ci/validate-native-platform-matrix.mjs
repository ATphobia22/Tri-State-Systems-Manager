#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..","..");
const required=["tsm-native/config/platform-build-matrix.json"];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
if(missing.length){console.error(JSON.stringify({ok:false,gate:"native-platform-matrix",missing},null,2));process.exit(1);}
const v=JSON.parse(fs.readFileSync(path.join(root,required[0]),"utf8")); const p=v.targets?.map(x=>x.platform)||[]; if(["Windows","macOS","iOS","iPadOS","Android","Linux"].some(x=>!p.includes(x))) process.exit(1);
console.log(JSON.stringify({ok:true,gate:"native-platform-matrix"},null,2));
