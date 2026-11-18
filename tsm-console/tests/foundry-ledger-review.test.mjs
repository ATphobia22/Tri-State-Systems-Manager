import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFoundryLedgerReview } from '../src/lib/foundry-ledger-review.ts';

const source = () => ({
  schema:'tsm.government.foundry-ledger-queue.v1',
  classification:'INFORMATIONAL_ONLY',
  sourceReportSha256:'a'.repeat(64),
  catalogSha256:'b'.repeat(64),
  ledgerSubmissionState:'NOT_SUBMITTED',
  ledgerMutationPerformed:false,
  immutableLedgerAcceptance:'NOT_EVIDENCED',
  regulatoryDetermination:false,
  reviewItemCount:1,
  entries:[{
    entryId:'FDR-'+'c'.repeat(24),
    kind:'SOURCE_DRIFT',sourceId:'indiana-dem',
    field:'horizontal_crs',reviewStatus:'PENDING_HUMAN_REVIEW',
    affectedPlanes:['terrain'],
    relationshipEvidence:'DECLARED_ONLY',
    entryPayloadSha256:'d'.repeat(64),
  }]
});
test('Foundry review stays separate from the immutable authorized ledger',()=>{
  const model=parseFoundryLedgerReview(source());
  assert.equal(model.entries[0].sourceId,'indiana-dem');
  assert.equal(model.ledgerSubmissionState,'NOT_SUBMITTED');
  assert.equal(model.entries[0].affectedPlanes[0],'terrain');
  assert.equal(model.regulatoryDetermination,false);
});
test('Foundry review rejects forged authorization and mismatched counts',()=>{
  const forged={...source(),ledgerSubmissionState:'ACCEPTED'};
  assert.throws(()=>parseFoundryLedgerReview(forged),/review|ledger|submitted|unauthorized/i);
  assert.throws(()=>parseFoundryLedgerReview({...source(),reviewItemCount:2}),/count/i);
});
test('Foundry review rejects malformed source identifiers and row digests',()=>{
  const forged=source();forged.entries[0].sourceId='<script>';
  assert.throws(()=>parseFoundryLedgerReview(forged),/identifier|source/i);
  const forged2=source();forged2.entries[0].entryPayloadSha256='invalid';
  assert.throws(()=>parseFoundryLedgerReview(forged2),/sha|digest/i);
});
