import assert from 'node:assert/strict';
import test from 'node:test';
import { assessDataset, promoteZone, type DatasetContract } from '../../packages/data-fabric/src/index.ts';
import { validateTwinState, createScenario, type TwinState } from '../../packages/twin/src/index.ts';

const dataset: DatasetContract = {
  datasetId:'usgs-3dep-example',
  title:'Example terrain dataset',
  owner:'USGS',
  steward:'USGS-3DEP',
  accessClass:'PUBLIC',
  authority:'OFFICIAL_GOVERNMENT',
  zone:'RAW',
  schemaVersion:'1',
  crs:'EPSG:2966',
  verticalDatum:'NAVD88',
  updateCadenceSeconds:86400,
  maxAgeSeconds:172800,
  lineage:{parentDatasetIds:[],transformationIds:[],sourceUri:'https://example.invalid/3dep',contentHash:'a'.repeat(64),retrievedAt:'2026-09-30T00:00:00Z'},
  quality:{status:'PASS',requiredFields:['elevation'],checks:['schema','crs','nodata']}
};

const state: TwinState = {
  stateId:'state-001',
  effectiveAt:'2026-09-30T00:00:00Z',
  sourceDatasetIds:[dataset.datasetId],
  entities:[
    {entityId:'river:ohio:001',kind:'river',validTime:{validFrom:'2026-09-30T00:00:00Z'},attributes:{stageFt:35},sourceDatasetIds:[dataset.datasetId]},
    {entityId:'sensor:gauge:001',kind:'sensor',validTime:{validFrom:'2026-09-30T00:00:00Z'},attributes:{status:true},sourceDatasetIds:[dataset.datasetId]}
  ],
  relationships:[
    {relationshipId:'rel-001',subjectEntityId:'sensor:gauge:001',predicate:'MONITORS',objectEntityId:'river:ohio:001',validTime:{validFrom:'2026-09-30T00:00:00Z'},sourceDatasetIds:[dataset.datasetId]}
  ],
  observations:[{entityId:'sensor:gauge:001',observedAt:'2026-09-30T00:00:00Z',observedValue:true,datasetId:dataset.datasetId}]
};

test('dataset quality gate fails closed',()=> {
  const bad = {...dataset,quality:{...dataset.quality,status:'STALE' as const}};
  assert.equal(assessDataset(bad).accepted,false);
});

test('raw dataset can be promoted only after quality/lineage checks',()=> {
  const assessment=assessDataset(dataset);
  assert.equal(assessment.accepted,true);
  assert.equal(promoteZone(dataset,'CURATED').zone,'CURATED');
});

test('4D twin validates entity relationships and temporal state',()=> {
  assert.deepEqual(validateTwinState(state),[]);
  assert.doesNotThrow(()=>createScenario(state,{scenarioId:'flood-1937',parentStateId:state.stateId,createdAt:'2026-09-30T00:00:00Z',assumptions:{returnPeriodYears:100},interventions:[]}));
});

test('orphan relationship is rejected',()=> {
  const invalid={...state,relationships:[{...state.relationships[0],objectEntityId:'missing'}]};
  assert.ok(validateTwinState(invalid).some((issue)=>issue.includes('objectEntityId')));
});

test('stale curated datasets are rejected',()=> {
  const stale={...dataset,zone:'CURATED' as const,lineage:{...dataset.lineage,retrievedAt:'2020-01-01T00:00:00Z'}};
  const assessment=assessDataset(stale,new Date('2026-09-30T00:00:00Z'));
  assert.equal(assessment.accepted,false);
  assert.equal(assessment.status,'STALE');
});
