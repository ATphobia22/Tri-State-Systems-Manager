describe('Public Cesium 4D view on the project Pages base', () => {
  it('streams terrain and buildings, draws local sources and switches replay and screening', () => {
    cy.intercept('GET', '**/data/cesium-regional/terrain/**/*.terrain').as('terrainTile');
    cy.intercept({ method: 'GET', pathname: '**/posey-buildings/content/**/*.glb' }).as('buildingTile');
    cy.intercept({ method: 'GET', pathname: '**/posey-buildings/subtrees/**/*.subtree' }).as('buildingSubtree');
    cy.intercept('GET', '**/posey-buildings/missing-height-footprints.json').as('poseyFootprints');
    cy.intercept('GET', '**/mount-vernon-scene/scene.json').as('city');
    cy.intercept('GET', '**/data/cesium-regional/screening/*.json').as('screening');
    cy.visit('cesium/');
    cy.contains('h1', 'Tri-State River Valley').should('be.visible');
    cy.get('.tsm-cesium-viewport canvas', { timeout: 30000 }).should('be.visible');
    cy.wait(['@terrainTile', '@poseyFootprints', '@buildingSubtree', '@buildingTile'], { requestTimeout: 60000 }).each((hit) => {
      expect(hit.response?.statusCode).to.eq(200);
    });
    cy.get('@poseyFootprints').its('response.body.metadata.featureCount').should('eq', 2565);
    cy.get('[data-testid="cesium-terrain-status"]').should('have.attr', 'data-state', 'ready');
    cy.get('[data-testid="cesium-buildings-status"]', { timeout: 45000 }).should('have.attr', 'data-state', 'ready');
    cy.contains('[data-testid="cesium-roads-status"]', '29,461 centerlines', { timeout: 45000 });
    cy.get('.tsm-cesium-error').should('not.exist');
    cy.contains('label', 'Mount Vernon detail').find('input').check();
    cy.wait('@city', { requestTimeout: 30000 }).its('response.statusCode').should('eq', 200);
    cy.get('[data-testid="cesium-city-status"]', { timeout: 30000 }).should('have.attr', 'data-state', 'ready');
    cy.contains('.tsm-cesium-reading a', 'Evansville, IN').should('exist');
    cy.get('#cesium-day').then(($range) => {
      const input = $range[0] as HTMLInputElement;
      const ownerWindow = input.ownerDocument.defaultView!;
      Object.getOwnPropertyDescriptor(ownerWindow.HTMLInputElement.prototype, 'value')!.set!.call(input, '0');
      input.dispatchEvent(new ownerWindow.Event('input', { bubbles: true }));
      input.dispatchEvent(new ownerWindow.Event('change', { bubbles: true }));
    });
    cy.contains('output', '2025-04-01');
    cy.contains('label', 'Show hypothetical extent').find('input').check();
    cy.wait('@screening').its('response.statusCode').should('eq', 200);
    cy.get('[data-testid="cesium-screening-status"]', { timeout: 20000 }).should('contain.text', 'Screening extent on map');
    cy.get('.tsm-cesium-error').should('not.exist');
    cy.screenshot('mount-vernon-cesium-and-screening');
    cy.get('#cesium-place').select('Henderson, KY');
    cy.get('.tsm-cesium-place').should('contain.text', 'Henderson, KY');
  });
  it('supports IN/IL/KY camera selection on a mobile Pages viewport', () => {
    cy.viewport(390, 844);
    cy.visit('atlas/');
    cy.get('#tsm-atlas-region').should('exist');
    cy.get('canvas.maplibregl-canvas', { timeout: 30000 }).should('exist');

    cy.get('#tsm-atlas-region').select('shawneetown');
    cy.get('[data-testid="atlas-region-title"]').should('contain.text', 'Shawneetown · Illinois');
    cy.get('.tsm-atlas-region-note').should('contain.text', 'Regional street basemap only');
    cy.contains('.tsm-atlas-map-layers label', 'Indiana').find('input').should('be.disabled');

    cy.get('#tsm-atlas-region').select('henderson');
    cy.get('[data-testid="atlas-region-title"]').should('contain.text', 'Henderson · Kentucky');
    cy.contains('.tsm-atlas-map-layers label', 'Indiana').find('input').should('be.disabled');

    cy.get('#tsm-atlas-region').select('posey');
    cy.get('[data-testid="atlas-region-title"]').should('contain.text', 'Mount Vernon · Posey IN');
    cy.screenshot('atlas-three-state-mobile-regions');
  });

});
