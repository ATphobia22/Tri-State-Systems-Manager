/** Browser acceptance with stubbed USGS response: no fabricated live observations. */
describe('Public gauge, memorial and unobstructed cinematic controls', () => {
  it('shows a source-labeled USGS stage from the official OGC request shape', () => {
    cy.intercept('GET', '**/data/tsm-river-gauge-locations.geojson').as('stations');
    cy.intercept('GET', 'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items*', (request) => {
      expect(request.url).to.include('monitoring_location_id=USGS-03378500');
      expect(request.url).to.include('parameter_code=00065');
      // Test fixture only: these values are not represented as a live feed.
      request.reply({ statusCode: 200, body: {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {
          monitoring_location_id: 'USGS-03378500', parameter_code: '00065',
          value: '1.78', unit_of_measure: 'ft',
          time: '2026-11-17T12:30:00+00:00',
          approval_status: 'Provisional', qualifier: null,
        } }],
      } });
    }).as('currentStage');
    cy.visit('/river-watch');
    cy.wait('@stations');
    cy.contains('button', 'Fetch current gage height (00065)').should('be.enabled').click();
    cy.wait('@currentStage');
    cy.contains('Latest retrieved stage').should('be.visible');
    cy.contains('1.78 ft').should('be.visible');
    cy.contains('2026-11-17T12:30:00+00:00').should('exist');
    cy.contains('Provisional').should('exist');
    cy.contains('no NAVD88 conversion').should('exist');
  });

  it('loads the Beverly Ann Tucker memorial directly and preserves its dedication', () => {
    cy.visit('/memorial');
    cy.contains('h1', 'In Memory of Beverly Ann Tucker').should('be.visible');
    cy.contains('whose love for family and community inspires everything built here').should('exist');
  });

  it('defaults to a clear cinematic viewport with reversible model and music disclosures', () => {
    cy.visit('/cinematic-engineering');
    cy.contains('button', 'Show engineering settings').should('have.attr', 'aria-expanded', 'false');
    cy.contains('button', 'Show model labels').should('have.attr', 'aria-pressed', 'false');
    cy.get('#tsm-cinema-model-overlay').should('not.exist');
    cy.get('.maplibregl-canvas', { timeout: 30000 }).should('exist');
    cy.contains('button', 'Show model labels').click();
    cy.get('#tsm-cinema-model-overlay').should('exist');
    cy.contains('button', 'Hide model labels').click();
    cy.get('#tsm-cinema-model-overlay').should('not.exist');
    cy.get('button[aria-label="Expand music controls"]').should('be.visible').click();
    cy.get('button[aria-label="Collapse music controls"]').should('be.visible').click();
    cy.get('button[aria-label="Expand music controls"]').should('be.visible');
  });
});
