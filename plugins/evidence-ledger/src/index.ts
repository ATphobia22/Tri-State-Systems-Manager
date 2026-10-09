// @tsm/plugin-evidence-ledger — UACF plugin scaffold (v0.1.0).
// Declares the plugin manifest only. No behavior is wired: every capability
// throws fail-closed until an operator configures the plugin.

export interface PluginManifest {
  name: string;
  version: string;
  capabilities: string[];
  status: 'scaffold';
}

export const manifest: PluginManifest = {
  name: '@tsm/plugin-evidence-ledger',
  version: '0.1.0',
  capabilities: ["hash-chained-records", "sha256-attestation", "human-review-gates"],
  status: 'scaffold',
};

function notConfigured(capability: string): never {
  throw new Error(`@tsm/plugin-evidence-ledger: capability '${capability}' is not configured (fail-closed).`);
}

export function invoke(capability: string, _input: unknown): never {
  if (!manifest.capabilities.includes(capability)) {
    throw new Error(`@tsm/plugin-evidence-ledger: unknown capability '${capability}'.`);
  }
  return notConfigured(capability);
}

export default manifest;
