#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..",".."); const file="tsm-native/config/runner-capability-contract.json"; const value=JSON.parse(fs.readFileSync(path.join(root,file),"utf8"));
if(!value.runnerClasses || !Object.keys(value.runnerClasses).length) throw new Error("runner capability contract has no runner classes");
for(const [name,runner] of Object.entries(value.runnerClasses)){if(!Array.isArray(runner.labels)||!Array.isArray(runner.requiredTools)) throw new Error(`invalid runner class: ${name}`);}
console.log(JSON.stringify({ok:true,gate:"runner-contract",runnerClasses:Object.keys(value.runnerClasses)},null,2));