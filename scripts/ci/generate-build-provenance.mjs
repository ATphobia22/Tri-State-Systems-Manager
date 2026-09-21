import fs from "node:fs";
import crypto from "node:crypto";
import {execFileSync} from "node:child_process";
const sha256 = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const git = (args) => execFileSync("git", args, {encoding:"utf8"}).trim();
const out = process.env.GITHUB_WORKSPACE ? process.env.GITHUB_WORKSPACE : process.cwd();
const manifest = process.env.TSM_DATA_MANIFEST;
const result = {
  schemaVersion: 1,
  repository: process.env.GITHUB_REPOSITORY || "unknown",
  workflow: process.env.GITHUB_WORKFLOW || "local",
  runId: process.env.GITHUB_RUN_ID || "local",
  gitCommit: process.env.GITHUB_SHA || git(["rev-parse","HEAD"]),
  runnerClass: process.env.TSM_RUNNER_CLASS || "github-hosted",
  os: process.platform,
  architecture: process.arch,
  compiler: process.env.CXX || "unknown",
  cmakeVersion: process.env.CMAKE_VERSION || "unknown",
  unrealVersion: process.env.UE_VERSION || "5.8",
  vcpkgBaseline: "5f96cd15fd745122cf27e0524606d6c1efc5fd07",
  dependencyLockHash: sha256(path(out,"native/dependencies/vcpkg-configuration.json")),
  dataManifestSha256: manifest && fs.existsSync(manifest) ? sha256(manifest) : null
};
fs.mkdirSync(path.join(out,"dist","provenance"), {recursive:true});
fs.writeFileSync(path.join(out,"dist","provenance","build-provenance.json"), JSON.stringify(result,null,2)+"\n");
function path(a,b){ return require("node:path").join(a,b); }
