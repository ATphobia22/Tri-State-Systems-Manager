import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
console.log('TSM Ingestion Worker (bootstrap)');
const dataDir = process.env.TSM_DATA_DIR ?? join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  console.log(`No data directory at ${dataDir} — idle`);
  process.exit(0);
}
const files = readdirSync(dataDir, { recursive: true, withFileTypes: true });
for (const entry of files) {
  if (entry.isFile()) console.log('discovered', entry.name);
}
console.log('Bootstrap worker does not promote assets or claim engineering authority.');
