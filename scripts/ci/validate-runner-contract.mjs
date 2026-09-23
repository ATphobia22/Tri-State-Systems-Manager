#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..","..");
const required=["tsm-native/config/runner-capability-contract.json","scripts/native/Validate-NativeRunner.ps1","scripts/native/validate-native-runner.sh"];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
if(missing.length){console.error(JSON.stringify({ok:false,gate:"runner-contract",missing},null,2));process.exit(1);}
console.log(JSON.stringify({ok:true,gate:"runner-contract",verifiedFiles:required},null,2));