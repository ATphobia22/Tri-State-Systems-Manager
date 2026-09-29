#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const MAX_REQUEST = 2 * 1024 * 1024;
const MAX_RESPONSE = 4 * 1024 * 1024;
const WORKER_ENV = {
  cad: "TSM_CAD_WORKER",
  usd: "TSM_USD_WORKER",
  vision: "TSM_VISION_WORKER",
  numerics: "TSM_NUMERICS_WORKER",
  routing: "TSM_ROUTING_WORKER",
  solver: "TSM_SOLVER_WORKER",
  "post-process": "TSM_POST_PROCESS_WORKER"
};

const [kind, inputPath] = process.argv.slice(2);
if (!kind || !WORKER_ENV[kind] || !inputPath) {
  throw new Error("usage: node worker-runner.mjs <cad|usd|vision|numerics|routing|solver|post-process> <json-input>");
}

const executable = process.env[WORKER_ENV[kind]];
if (!executable) {
  throw new Error(`${WORKER_ENV[kind]} is not configured; refusing implicit fallback`);
}

const input = readFileSync(inputPath);
if (input.byteLength > MAX_REQUEST) throw new Error("worker request exceeds 2 MiB");

const inputHash = createHash("sha256").update(input).digest("hex");
const child = spawn(executable, [], {
  stdio: ["pipe", "pipe", "pipe"],
  shell: false,
  windowsHide: true,
  env: { ...process.env, TSM_WORKER_KIND: kind }
});

const chunks = [];
let responseBytes = 0;
let stderr = "";
const timeout = setTimeout(() => child.kill("SIGKILL"), Number(process.env.TSM_WORKER_TIMEOUT_MS ?? 120000));

child.stdout.on("data", (chunk) => {
  responseBytes += chunk.byteLength;
  if (responseBytes > MAX_RESPONSE) child.kill("SIGKILL");
  else chunks.push(chunk);
});
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString("utf8").slice(0, 4000);
});
child.on("error", (error) => {
  clearTimeout(timeout);
  process.stderr.write(error.stack ?? String(error));
  process.exitCode = 1;
});
child.on("close", (code) => {
  clearTimeout(timeout);
  if (code !== 0) {
    process.stderr.write(`worker failed: kind=${kind} code=${code} inputSha256=${inputHash} ${stderr}`);
    process.exitCode = code ?? 1;
    return;
  }
  const output = Buffer.concat(chunks);
  let parsed;
  try { parsed = JSON.parse(output.toString("utf8")); }
  catch (error) {
    throw new Error(`worker returned invalid JSON: ${String(error)}`);
  }
  const result = {
    schemaVersion: "TSM-WorkerEnvelope-1.0",
    workerKind: kind,
    inputSha256: inputHash,
    outputSha256: createHash("sha256").update(output).digest("hex"),
    result: parsed
  };
  process.stdout.write(JSON.stringify(result) + "\n");
});
child.stdin.end(input);
