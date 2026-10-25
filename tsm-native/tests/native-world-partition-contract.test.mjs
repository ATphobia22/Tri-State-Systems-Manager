import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (relative) => readFileSync(new URL(relative, root), 'utf8');

test('the native game mode creates a source only for genuine World Partition worlds', () => {
  const gameMode = read('Source/TSMNative/TSMNativeGameMode.cpp');
  const header = read('Source/TSMNative/TSMNativeGameMode.h');
  assert.match(gameMode, /World->GetWorldPartition\(\)/);
  assert.match(gameMode, /SpawnActor<ATSMWorldPartitionStreamingAnchor>/);
  assert.match(header, /GetStreamingAnchor\(\)/);
});

test('the streaming source is disabled until a validated Unreal-local location is requested', () => {
  const header = read('Source/TSMNative/TSMWorldPartitionStreamingAnchor.h');
  const code = read('Source/TSMNative/TSMWorldPartitionStreamingAnchor.cpp');
  assert.match(header, /UWorldPartitionStreamingSourceComponent/);
  assert.match(header, /PrefetchAtUnrealLocation/);
  assert.match(header, /IsPrefetchReady/);
  assert.match(code, /CancelPrefetch\(\);/);
  assert.match(code, /StreamingSource->DisableStreamingSource\(\)/);
  assert.match(code, /WorldPositionCm\.ContainsNaN\(\)/);
  assert.match(code, /StreamingSource->IsStreamingCompleted\(\)/);
  assert.match(code, /StreamingSource->EnableStreamingSource\(\)/);
});

test('native preparation refuses a fictitious map and uses the official HLOD builder', () => {
  const script = read('Tools/Prepare-WorldPartition.ps1');
  assert.match(script, /TSMRegion/);
  assert.match(script, /Test-Path -LiteralPath \$MapFile -PathType Leaf/);
  assert.match(script, /WorldPartitionBuilderCommandlet/);
  assert.match(script, /WorldPartitionHLODsBuilder/);
  assert.match(script, /LASTEXITCODE -ne 0/);
  assert.match(script, /AdoptAsDefaultMap/);
  assert.match(script, /successful HLOD build/);
});

test('Cesium remains a separate offline tile loader', () => {
  const offlineTiles = read('Source/TSMNative/TSMOfflineTileset.cpp');
  assert.match(offlineTiles, /ToCesiumFileUrl/);
  assert.match(offlineTiles, /SetTilesetSource\(ETilesetSource::FromUrl\)/);
  assert.match(offlineTiles, /SetMaximumScreenSpaceError/);
  const docs = read('docs/WORLD-PARTITION-UE58.md');
  assert.match(docs, /23,082/);
  assert.match(docs, /Is Spatially Loaded disabled/);
});

test('engine template is not falsely asserted as a packaged map', () => {
  const config = read('Config/DefaultEngine.ini');
  const docs = read('docs/WORLD-PARTITION-UE58.md');
  if (config.includes('GameDefaultMap=/Engine/Maps/Templates/OpenWorld')) {
    assert.match(docs, /project-owned UE5\.8 binary map is NOT committed/);
  }
});
