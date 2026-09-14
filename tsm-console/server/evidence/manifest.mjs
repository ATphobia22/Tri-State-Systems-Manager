import { createHash } from 'node:crypto';

const canonicalJson = (value) => JSON.stringify(value, Object.keys(value).sort());
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

export function buildEvidenceManifest(input) {
  if (!input || typeof input !== 'object') throw new TypeError('manifest input is required');
  for (const field of ['artifactId','scenarioId','crs','verticalDatum','modelVersion','equationSetId','reviewerRole','reviewState']) {
    if (typeof input[field] !== 'string' || input[field].length === 0) throw new TypeError(`${field} is required`);
  }
  const inputsCanonical = canonicalJson(input.inputs ?? {});
  const outputsCanonical = canonicalJson(input.outputs ?? {});
  const inputSha256 = sha256(inputsCanonical);
  const outputSha256 = sha256(outputsCanonical);
  const base = {
    artifactId: input.artifactId,
    scenarioId: input.scenarioId,
    sources: input.sources ?? [],
    crs: input.crs,
    verticalDatum: input.verticalDatum,
    modelVersion: input.modelVersion,
    equationSetId: input.equationSetId,
    numericalTolerance: input.numericalTolerance ?? null,
    reviewerRole: input.reviewerRole,
    reviewState: input.reviewState,
    inputSha256,
    outputSha256,
  };
  const manifestSha256 = sha256(JSON.stringify(base, Object.keys(base).sort()));
  return Object.freeze({ ...base, manifestSha256 });
}
