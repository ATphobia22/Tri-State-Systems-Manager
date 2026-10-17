#!/usr/bin/env node
/**
 * CLI: npm run nfhl:validate
 * Exit 1 on NFHL MapServer drift (count / geometry / missing ID).
 */
import { validateLiveNfhl, validationEvidencePayload } from '../NfhlMetadataValidator.js';

async function main(): Promise<void> {
  const result = await validateLiveNfhl();
  const payload = validationEvidencePayload(result);
  console.log(JSON.stringify(payload, null, 2));
  if (!result.valid) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(JSON.stringify({ valid: false, error: String(err) }, null, 2));
  process.exit(1);
});
