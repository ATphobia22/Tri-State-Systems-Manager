#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path";
const root=path.resolve(import.meta.dirname,"..","..");
const required=["tsm-console/server/reliability/circuit-breaker.mjs","tsm-console/server/reliability/dead-letter-queue-runtime.mjs","tsm-console/server/reliability/freshness.mjs","tsm-console/server/reliability/retry-policy.mjs","tsm-console/server/reliability/source-policies.mjs","tsm-console/server/reliability/stale-cache.mjs","tsm-console/tests/reliability-primitives.test.mjs"];
const missing=required.filter(p=>!fs.existsSync(path.join(root,p)));
if(missing.length){console.error(JSON.stringify({ok:false,gate:"production-reliability",missing},null,2));process.exit(1);}

console.log(JSON.stringify({ok:true,gate:"production-reliability"},null,2));
