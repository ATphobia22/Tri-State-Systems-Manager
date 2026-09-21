import fs from "node:fs";
const file = "tsm-native/config/runner-capability-contract.json";
const doc = JSON.parse(fs.readFileSync(file, "utf8"));
const required = ["linux-native","windows-ue5","macos-ue5","ios-ue5","android-ue5"];
for (const name of required) {
  const runner = doc.runnerClasses[name];
  if (!runner || !Array.isArray(runner.labels) || !Array.isArray(runner.requiredTools)) throw new Error(`Invalid runner contract: ${name}`);
  if (!runner.labels.includes("self-hosted")) throw new Error(`Runner must be self-hosted: ${name}`);
}
if (doc.security.secretsOnRunner !== false || doc.security.networkDataSourcesInSovereignRuntime !== false) throw new Error("Runner security contract violated.");
console.log("Runner capability contract validated.");
