/** Real-browser acceptance: no login, no external live data, no forged source claims. */
const demoBuilding = (id: number, height_m?: number) => ({
  type: 'Feature', geometry: {
    type: 'Polygon', coordinates: [[
      [-87.896, 37.932], [-87.895, 37.932],
      [-87.895, 37.933], [-87.896, 37.933], [-87.896, 37.932],
    ]],
  }, properties: { sourceObjectId: id, height_m, owner: 'SENSITIVE_NOT_FOR_QA' },
});
const qa = { type: 'FeatureCollection', features: [
  demoBuilding(1001, 6.5), demoBuilding(1002), demoBuilding(1003, -1),
] };
const foundry = {
  schema: 'tsm.government.foundry-ledger-queue.v1',
  classification: 'INFORMATIONAL_ONLY',
  sourceReportSha256: 'a'.repeat(64), catalogSha256: 'b'.repeat(64),
  ledgerSubmissionState: 'NOT_SUBMITTED', ledgerMutationPerformed: false,
  immutableLedgerAcceptance: 'NOT_EVIDENCED', regulatoryDetermination: false,
  reviewItemCount: 1,
  entries: [{
    entryId: 'FDR-' + 'c'.repeat(24),
    kind: 'SOURCE_DRIFT', sourceId: 'IGIO-POSEY', field: 'vertical_datum',
    reviewStatus: 'PENDING_HUMAN_REVIEW', affectedPlanes: ['terrain'],
    relationshipEvidence: 'DECLARED_ONLY', entryPayloadSha256: 'd'.repeat(64),
  }],
};

describe('GeoTruth and Foundry, actual browser integration', () => {
  beforeEach(() => cy.viewport(1280, 900));

  it('loads Posey QA only after opt-in and leaves the map available after hiding', () => {
    // Use an explicitly synthetic 2×2 test tile; live IGIO imagery latency must
    // not determine when MapLibre's initial load event enables QA controls.
    // This fixture does not verify the actual government imagery endpoint.
    cy.intercept('GET', '**/Indiana_Current_Imagery/ImageServer/exportImage*', {
      statusCode: 200,
      headers: { 'content-type': 'image/png', 'access-control-allow-origin': '*' },
      body: Cypress.Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGMU0bD5z8DAwMDEAAUAFYABe3P1OxMAAAAASUVORK5CYII=', 'base64'),
    }).as('imageryFixture');
    cy.intercept('GET', '**/3d-tiles/buildings-3d.json', {
      statusCode: 200, body: qa,
    }).as('qa');
    cy.visit('/map');
    cy.wait('@imageryFixture');
    cy.get('.maplibregl-canvas', { timeout: 30000 }).should('exist');
    cy.get('details[aria-label="Map layers, data and engineering tools"] > summary').click();
    cy.contains('summary', 'Map overlays and camera controls').click();
    cy.get('details[aria-label="GeoTruth building quality inspector"] > summary').click();
    cy.contains('button', 'Load QA layer (opt-in)').should('be.enabled').click();
    cy.wait('@qa');
    cy.contains('QA available: 3 published records').should('exist');
    cy.contains('Imported height estimates: 1').should('exist');
    cy.contains('Missing/invalid heights: 2').should('exist');
    cy.screenshot('qa-map-fixture-enabled');
    // Closing the inspector must release its temporary QA overlay and opt-in state.
    cy.get('details[aria-label="GeoTruth building quality inspector"] > summary').click();
    cy.get('details[aria-label="GeoTruth building quality inspector"]').should('not.have.attr', 'open');
    cy.get('details[aria-label="GeoTruth building quality inspector"] > summary').click();
    cy.contains('button', 'Load QA layer (opt-in)').should('have.attr', 'aria-pressed', 'false');
    cy.contains('QA available: 3 published records').should('not.exist');
    cy.contains('button', 'Load QA layer (opt-in)').click();
    cy.contains('QA available: 3 published records').should('exist');
    cy.contains('button', 'Hide QA layer').click();
    cy.contains('button', 'Load QA layer (opt-in)').should('exist');
    cy.get('.maplibregl-canvas').should('exist');
    cy.contains('SENSITIVE_NOT_FOR_QA').should('not.exist');
  });

  it('exposes the opt-in GeoTruth map layer in public Atlas even with its original sidebar hidden', () => {
    // The QA integration must not rely on availability or timing of a third-party
    // vector basemap. A deliberately empty test style lets the real MapLibre
    // lifecycle complete, while the QA GeoJSON stays a clearly synthetic fixture.
    cy.intercept('GET', 'https://tiles.openfreemap.org/styles/liberty*', {
      statusCode: 200,
      headers: { 'access-control-allow-origin': '*' },
      body: { version: 8, name: 'E2E fixture basemap (no authoritative layers)', sources: {}, layers: [] },
    }).as('atlasStyle');
    cy.intercept('GET', '**/3d-tiles/buildings-3d.json', {
      statusCode: 200, body: qa,
    }).as('qa');
    cy.visit('/atlas');
    cy.wait('@atlasStyle');
    cy.get('.maplibregl-canvas', { timeout: 30000 }).should('exist');
    cy.get('details[aria-label="GeoTruth building quality inspector"] > summary').should('be.visible').click();
    cy.contains('button', 'Load QA layer (opt-in)').should('be.enabled').click();
    cy.wait('@qa');
    cy.contains('QA available: 3 published records').should('exist');
    cy.screenshot('qa-atlas-fixture-enabled');
  });

  it('imports a bounded local Foundry report beside, not into, the immutable ledger', () => {
    cy.visit('/ledger');
    cy.contains('h1', 'Evidence Ledger').should('be.visible');
    cy.contains('summary', 'Government Data Contract Foundry').click();
    cy.get('#tsm-foundry-local-review').selectFile({
      contents: Cypress.Buffer.from(JSON.stringify(foundry)),
      fileName: 'foundry-ledger-review.json', mimeType: 'application/json',
    });
    cy.contains('1 review items').should('exist');
    cy.contains('NOT_SUBMITTED').should('exist');
    cy.contains('IGIO-POSEY').should('exist');
    cy.contains('PENDING_HUMAN_REVIEW').should('exist');
    cy.contains('not a signed or accepted ledger block').should('exist');
    cy.screenshot('foundry-ledger-review-fixture');
  });
});
