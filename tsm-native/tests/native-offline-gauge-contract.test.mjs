import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..', '..');
const header = fs.readFileSync(path.join(root, 'tsm-native/Source/TSMNative/TSMOfflineGaugeReader.h'), 'utf8');
const source = fs.readFileSync(path.join(root, 'tsm-native/Source/TSMNative/TSMOfflineGaugeReader.cpp'), 'utf8');

test('UE Shipping has an actual read-only local gauge load entrypoint', () => {
  assert.match(header, /UFUNCTION\(BlueprintCallable/);
  assert.match(header, /LoadPackagedGaugeViews/);
  assert.match(source, /ProjectContentDir\(\)/);
  assert.match(source, /TEXT\("observations"\)/);
  assert.match(source, /FFileHelper::LoadFileToArray/);
  assert.doesNotMatch(source, /FHttpModule|localhost|WebView|FPlatformProcess::CreateProc/);
});

test('native gauge reader verifies bounded receipt bytes and source distinctions', () => {
  assert.match(source, /TsmComputeSha256/);
  assert.match(source, /LOCAL_GAUGE_SHA256_MISMATCH/);
  assert.match(source, /1024 \* 1024/);
  assert.match(source, /tsm\.offline-gauge-export\.v1/);
  assert.match(source, /tsm\.offline-gauge-view\.v1/);
  assert.match(source, /UNSIGNED_LOCAL_SHA256_ONLY/);
  assert.match(source, /REVIEW_REQUIRED/);
  assert.match(source, /STATION_GAGE_DATUM_UNRESOLVED/);
  assert.match(source, /LOCAL_CLOCK_BEFORE_OBSERVATION/);
  assert.match(source, /SOURCE_UNAVAILABLE/);
});
