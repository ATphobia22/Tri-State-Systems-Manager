#!/usr/bin/env node
import fs from "node:fs"; import path from "node:path"; import {execFileSync} from "node:child_process";
const root=path.resolve(import.meta.dirname,"..",".."); const out=path.join(root,"dist/provenance/build-provenance.json"); fs.mkdirSync(path.dirname(out),{recursive:true});
const gitSha=process.env.GITHUB_SHA||execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(); const value={schemaVersion:1,gitSha,runnerClass:process.env.TSM_RUNNER_CLASS||"unspecified",generatedAt:new Date().toISOString(),repository:"ATphobia22/Tri-State-Systems-Manager"};
fs.writeFileSync(out,JSON.stringify(value,null,2)+"\n"); console.log(JSON.stringify(value,null,2));