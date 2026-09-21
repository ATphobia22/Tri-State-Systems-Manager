import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = path.join(root, "tsm-native/config/data-fabric-contract.json");
const doc = JSON.parse(fs.readFileSync(file, "utf8"));
if (doc.schemaVersion !== 1) throw new Error("Unsupported data-fabric contract schema.");
for (const layer of doc.layers) {
  if (!layer.name || layer.mutable !== false) throw new Error("Data fabric layers must be explicitly immutable.");
}
for (const key of ["recordId","sourceDatasetId","sourceVersion","retrievedAtUtc","horizontalCrs","verticalDatum","units","geometry","contentSha256","lineage"]) {
  if (!doc.recordContract.required.includes(key)) throw new Error(`Missing required provenance field: ${key}`);
}
for (const key of ["sourceUri","sourceRecordId","transformationId","transformationVersion"]) {
  if (!doc.recordContract.lineage.includes(key)) throw new Error(`Missing lineage field: ${key}`);
}
console.log("Data fabric contract validated.");
