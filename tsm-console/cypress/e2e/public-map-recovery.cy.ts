describe('Public 4D map incident regressions', () => {
  it('opens the memorial instead of redirecting to the Atlas', () => {
    cy.visit('/atlas');
    cy.contains('a', 'In loving memory').click();
    cy.location('pathname').should('include', '/memorial');
    cy.contains('h1', 'In Memory of Beverly Ann Tucker').should('be.visible');
  });

  it('queries official USGS gage heights in a static browser without a TSM backend', () => {
    cy.intercept('GET', '**/data/tsm-river-gauge-locations.geojson').as('stations');
    cy.intercept('GET', 'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items*', (req) => {
      expect(req.url).to.include('monitoring_location_id=USGS-03378500');
      expect(req.url).to.include('parameter_code=00065');
      req.reply({ statusCode: 200, body: { type: 'FeatureCollection', features: [
        { type: 'Feature', properties: { monitoring_location_id: 'USGS-03378500',
          parameter_code: '00065', value: '1.78', unit_of_measure: 'ft',
          time: '2026-11-17T10:30:00+00:00', approval_status: 'Provisional',
          qualifier: null } },
      ] } });
    }).as('stage');
    cy.visit('/river-watch');
    cy.wait('@stations');
    cy.contains('button', 'Fetch current gage height (00065)').should('be.enabled').click();
    cy.wait('@stage');
    cy.contains('Latest retrieved stage').should('exist');
    cy.contains('1.78 ft').should('exist');
    cy.contains('2026-11-17T10:30:00+00:00').should('exist');
    cy.contains('Provisional').should('exist');
    cy.contains('no NAVD88 conversion').should('exist');
  });

  it('opens mobile 3D terrain with a clear, dismissible map layer drawer', () => {
    cy.viewport(390, 844);
    cy.visit('/terrain-3d');
    cy.get('button[aria-controls="tsm-map-plane-tools"]').should('have.attr', 'aria-expanded', 'false').click();
    cy.get('button[aria-controls="tsm-map-plane-tools"]').should('have.attr', 'aria-expanded', 'true');
    cy.get('#tsm-map-plane-tools').should('be.visible');
    cy.get('button[aria-controls="tsm-map-plane-tools"]').click();
    cy.get('#tsm-map-plane-tools').should('not.exist');
  });

  it('opens flood simulator with map-first layout and accessible flythrough', () => {
    cy.viewport(390, 844);
    cy.visit('/flood-sim');
    cy.contains('.tsm-flood-toolbar button', 'Show simulation controls').should('have.attr', 'aria-expanded', 'false');
    cy.get('#tsm-flood-controls').should('not.be.visible');
    cy.contains('.tsm-flood-toolbar button', 'Show simulation controls').click();
    cy.get('#tsm-flood-controls').should('be.visible');
    cy.contains('.tsm-flood-toolbar button', 'Hide simulation controls').click();
    cy.get('#tsm-flood-controls').should('not.be.visible');
    cy.contains('.tsm-flood-toolbar a', 'Source-backed Cesium 3D').should('have.attr', 'href').and('include', '/cesium');
  });

  it('keeps cinematic HUD collapsed and makes Cesium building controls discoverable', () => {
    cy.visit('/cinematic');
    cy.contains('button', 'Show cinematic tools').should('have.attr', 'aria-expanded', 'false');
    cy.contains('a', 'Explore Cesium 3D buildings and flyovers').should('exist');
    cy.contains('button', 'Show cinematic tools').click();
    cy.contains('button', 'Hide cinematic tools').should('have.attr', 'aria-expanded', 'true');
    cy.contains('button', 'Hide cinematic tools').click();
    cy.contains('button', 'Show cinematic tools').should('have.attr', 'aria-expanded', 'false');
  });

  it('loads a real Cesium viewport in engineering cinema with hideable model tools', () => {
    cy.visit('/cinematic-engineering');
    cy.contains('button', 'Show engineering controls').should('have.attr', 'aria-expanded', 'false');
    cy.get('.tsm-cesium-viewport canvas', { timeout: 30000 }).should('be.visible');
    cy.get('[data-testid="cesium-buildings-quick-toggle"]').should('exist');
    cy.contains('button', 'Show engineering controls').click();
    cy.get('#tsm-cinema-model-tools').should('be.visible');
    cy.contains('button', 'Hide engineering controls').click();
    cy.get('#tsm-cinema-model-tools').should('not.be.visible');
  });
});