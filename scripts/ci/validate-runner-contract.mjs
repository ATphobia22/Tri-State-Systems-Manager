#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..","..");
const required=["tsm-native/config/runner-capability-contract.json"];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
if(missing.length){console.error(JSON.stringify({ok:false,gate:"runner-contract",missing},null,2));process.exit(1);}
const v=JSON.parse(fs.readFileSync(path.join(root,required[0]),"utf8")); if(!v.runnerClasses) throw new Error("runnerClasses missing");
console.log(JSON.stringify({ok:true,gate:"runner-contract"},null,2));
