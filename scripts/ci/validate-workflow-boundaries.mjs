#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const WORKFLOW_DIR = resolve(ROOT, '.github/workflows');
const governed = new Set(['ci.yml', 'infrastructure-ci.yml', 'geospatial-ci.yml', 'container-ci.yml', 'quantum-ci.yml', 'databricks-lakehouse.yml']);
const forbidden = [/curl[^\n|]*\|\s*(ba)?sh/i, /wget[^\n|]*\|\s*(ba)?sh/i, /source\s+<\(\s*(curl|wget)/i];
const requiredPermission = /permissions:\s*\n\s+contents:\s+read/m;
const errors = [];

for (const name of await readdir(WORKFLOW_DIR)) {
  if (!name.endsWith('.yml') && !name.endsWith('.yaml')) continue;
  const path = resolve(WORKFLOW_DIR, name);
  const text = await readFile(path, 'utf8');
  for (const pattern of forbidden) if (pattern.test(text)) errors.push(name + ': forbidden remote execution pattern');
  if (governed.has(name) && !requiredPermission.test(text)) errors.push(name + ': missing explicit contents: read permission');
  if (name === 'databricks-lakehouse.yml') {
    if (!/id-token:\s*write/.test(text)) errors.push('databricks-lakehouse.yml: GitHub OIDC requires id-token: write');
    if (!/DATABRICKS_AUTH_TYPE:\s*github-oidc/.test(text)) errors.push('databricks-lakehouse.yml: Databricks authentication must use github-oidc');
    if (/DATABRICKS_TOKEN|DATABRICKS_CLIENT_SECRET/.test(text)) errors.push('databricks-lakehouse.yml: long-lived Databricks credentials are forbidden');
    if (!/sha256sum --check --strict/.test(text)) errors.push('databricks-lakehouse.yml: downloaded Databricks CLI must be SHA-256 verified');
  }
  if (name === 'quantum-ci.yml') {
    const runners = [...text.matchAll(/runs-on:\s*([^\n#]+)/g)].map((match) => match[1].trim());
    if (runners.length === 0) errors.push('quantum-ci.yml: missing runs-on declaration');
    else if (runners.some((runner) => !/^ubuntu([-\w.]*)?$/i.test(runner))) errors.push('quantum-ci.yml: quantum research must use a controlled hosted ubuntu runner unless explicitly isolated');
  }
  if (name === 'geospatial-ci.yml' && /cityengine|unreal/i.test(text) && !/workflow_dispatch/.test(text)) errors.push('geospatial-ci.yml: specialized tooling must be independently dispatchable');
  if (name === 'deploy-pages.yml') {
    if (!/VITE_TSM_API_BASE_URL:\s*\$\{\{\s*vars\.VITE_TSM_API_BASE_URL\s*\}\}/.test(text)) errors.push('deploy-pages.yml: production build must expose the optional live API base URL repository variable');
    if (/VITE_KEYCLOAK_URL|VITE_KEYCLOAK_REALM|VITE_KEYCLOAK_CLIENT_ID/.test(text) && !/optional|privileged|public read access/i.test(text)) errors.push('deploy-pages.yml: identity-provider bindings must remain explicitly optional');
  }
  if (name === 'ci.yml') {
    const alertmanagerCheck = /docker run[\s\S]*?prom\/alertmanager:v0\.34\.0@sha256:[0-9a-f]{64}[\s\S]*?check-config[\s\S]*?--enable-feature=utf8-strict-mode/m.test(text);
    if (!alertmanagerCheck || !/--entrypoint=\/bin\/amtool/.test(text)) errors.push('ci.yml: Alertmanager validation must invoke the pinned amtool binary with UTF-8 strict validation');
    const prometheusCheck = /docker run[\s\S]*?prom\/prometheus:v3\.14\.0@sha256:[0-9a-f]{64}[\s\S]*?check config[\s\S]*?\/config\/prometheus\.yml/m.test(text);
    if (!prometheusCheck || !/--entrypoint=\/bin\/promtool/.test(text)) errors.push('ci.yml: Prometheus validation must invoke the pinned promtool binary when a config exists');
    if (/prom\/(?:alertmanager|prometheus):latest\b/.test(text)) errors.push('ci.yml: monitoring validation must not use floating :latest image tags');
  }
}

if (errors.length) { errors.forEach((error) => console.error('WORKFLOW BOUNDARY ERROR: ' + error)); process.exit(1); }
console.log('Workflow boundary checks passed.');
