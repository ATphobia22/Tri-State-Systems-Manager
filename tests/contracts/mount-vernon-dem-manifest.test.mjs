import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const evidence=JSON.parse(readFileSync(new URL('../../docs/evidence/mount-vernon-3dtiles-dem-preview-2026-11-09.json',import.meta.url)));
test('rendered input hashes are nonempty and distinct',()=>{assert.equal(evidence.sources.length,2);for(const x of evidence.sources)assert.match(x.sha256,/^[0-9a-f]{64}$/);assert.notEqual(evidence.sources[0].sha256,evidence.sources[1].sha256);});
test('preview mesh checks do not represent Transvoxel acceptance',()=>{assert.equal(evidence.preview.glbTiles,32);assert.equal(evidence.preview.adjacentSameLODMeshEdges,48);assert.equal(evidence.preview.passedPreviewEdgeCheck,true);assert.equal(evidence.preview.mixedLODTransvoxelValidation,'NOT_EVIDENCED');});
test('vertical and Unreal evidence cannot be silently promoted',()=>{assert.equal(evidence.verticalDatum,'PENDING_EVIDENCE');assert.equal(evidence.regulatoryStatus,'NOT_A_REGULATORY_DETERMINATION');assert.equal(evidence.preview.headedUE58,'NOT_EVIDENCED');});
