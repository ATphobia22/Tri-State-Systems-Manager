import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const required = [
  'architecture/contracts/enterprise-data-architecture.json',
  'architecture/contracts/business-glossary.json',
  'architecture/contracts/data-product-contract.json',
  'architecture/contracts/metadata-catalog.json',
  'architecture/contracts/logical-data-model.json',
  'architecture/contracts/data-dictionary.json',
  'architecture/contracts/physical-data-model.json',
  'architecture/contracts/api-governance.json',
  'architecture/contracts/ingestion-pipeline-contract.json',
  'architecture/contracts/streaming-contract.json',
  'architecture/contracts/architecture-repository.json',
  'architecture/contracts/authoritative-source-registry.json',
  'architecture/contracts/lineage-registry.json',
  'architecture/contracts/backup-recovery-contract.json',
  'architecture/contracts/observability-contract.json',
];
const errors = [];
for (const file of required) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) { errors.push('missing architecture repository artifact: ' + file); continue; }
  try { JSON.parse(fs.readFileSync(full, 'utf8')); } catch (e) { errors.push('invalid JSON: ' + file + ': ' + e.message); }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Architecture repository completeness: PASS (' + required.length + ' contracts)');
