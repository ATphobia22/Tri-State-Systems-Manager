import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(process.argv[2] ?? ".");
const output = path.resolve(process.argv[3] ?? "dist/provenance/release-manifest.json");
if (!fs.existsSync(root)) throw new Error("Artifact root does not exist: " + root);

function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function walk(dir) {
  const out=[];
  for (const name of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const full=path.join(dir,name.name);
    if(name.isDirectory()) out.push(...walk(full));
    else if(name.isFile()) out.push(full);
  }
  return out;
}
const files=walk(root).map(file=>({
  path:path.relative(root,file).split(path.sep).join("/"),
  sizeBytes:fs.statSync(file).size,
  sha256:hash(file)
}));
const manifest={
  schemaVersion:1,
  generatedAtUtc:new Date().toISOString(),
  repository:process.env.GITHUB_REPOSITORY ?? "local",
  commit:process.env.GITHUB_SHA ?? "local",
  workflow:process.env.GITHUB_WORKFLOW ?? "local",
  runner:process.env.TSM_RUNNER_CLASS ?? "unknown",
  artifactRoot:path.relative(process.cwd(),root).split(path.sep).join("/"),
  integrity:"sha256",
  files
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(manifest,null,2)+"\n");
console.log("Release manifest written:",output);
