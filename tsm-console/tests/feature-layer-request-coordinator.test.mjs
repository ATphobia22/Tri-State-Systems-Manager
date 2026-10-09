import test from 'node:test';
import assert from 'node:assert/strict';

const { FeatureLayerRequestCoordinator } = await import('../src/lib/feature-layer-request-coordinator.ts');

test('independent visible feature layers can all publish their results concurrently', async () => {
  const requests = new FeatureLayerRequestCoordinator();
  const ids = ['indiana-parcels', 'indiana-roads', 'posey-cslf'];
  const published = [];

  await Promise.all(ids.map(async (id) => {
    const request = requests.begin(id);
    await Promise.resolve({ id });
    if (request.isCurrent()) published.push(id);
    request.finish();
  }));

  assert.deepEqual(published.sort(), [...ids].sort());
});

test('a newer request aborts only the older request for the same layer', () => {
  const requests = new FeatureLayerRequestCoordinator();
  const parcels = requests.begin('indiana-parcels');
  const roads = requests.begin('indiana-roads');
  const newerParcels = requests.begin('indiana-parcels');

  assert.equal(parcels.signal.aborted, true);
  assert.equal(parcels.isCurrent(), false);
  assert.equal(roads.signal.aborted, false);
  assert.equal(roads.isCurrent(), true);
  assert.equal(newerParcels.signal.aborted, false);
  assert.equal(newerParcels.isCurrent(), true);
});

test('cancelling a layer invalidates and aborts its active request', () => {
  const requests = new FeatureLayerRequestCoordinator();
  const request = requests.begin('posey-cslf');

  requests.cancel('posey-cslf');

  assert.equal(request.signal.aborted, true);
  assert.equal(request.isCurrent(), false);
});

test('cleanup cancels and invalidates every active layer request', () => {
  const requests = new FeatureLayerRequestCoordinator();
  const parcels = requests.begin('indiana-parcels');
  const roads = requests.begin('indiana-roads');

  requests.cancelAll();

  assert.equal(parcels.signal.aborted, true);
  assert.equal(parcels.isCurrent(), false);
  assert.equal(roads.signal.aborted, true);
  assert.equal(roads.isCurrent(), false);
});
