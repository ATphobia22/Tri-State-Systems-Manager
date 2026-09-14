import { createHash } from 'node:crypto';

export function canonicalJson(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function buildEvidenceManifest({ projectId, inputs, outputs, modelVersion, equationSet, numericalTolerance, generatedAt }) {
  if (!projectId || !modelVersion || !equationSet || !generatedAt) throw new Error('projectId, modelVersion, equationSet and generatedAt are required');
  const inputHash = sha256(canonicalJson(inputs ?? {}));
  const outputHash = sha256(canonicalJson(outputs ?? {}));
  const manifest = {
    schema: 'tsm.engineering-evidence-manifest.v1',
    projectId,
    modelVersion,
    equationSet,
    numericalTolerance: numericalTolerance ?? null,
    generatedAt,
    inputHashSha256: inputHash,
    outputHashSha256: outputHash,
    reviewState: 'ENGINEERING_REVIEW_READY',
    authorityBoundary: 'Software evidence package; not engineering certification or agency acceptance.',
  };
  return { ...manifest, manifestHashSha256: sha256(canonicalJson(manifest)) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const generatedAt = process.env.TSM_GENERATED_AT || new Date().toISOString();
  const manifest = buildEvidenceManifest({
    projectId: process.env.TSM_PROJECT_ID || 'lower-wabash-ohio-community',
    inputs: {},
    outputs: {},
    modelVersion: process.env.TSM_MODEL_VERSION || 'unbound',
    equationSet: process.env.TSM_EQUATION_SET || 'unbound',
    numericalTolerance: process.env.TSM_NUMERICAL_TOLERANCE || null,
    generatedAt,
  });
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}
