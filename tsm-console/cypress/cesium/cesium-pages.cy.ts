describe('Public Cesium 4D view on the project Pages base', () => {
  it('streams terrain and buildings, draws local sources and switches replay and screening', () => {
    cy.intercept('GET', '**/data/cesium-regional/terrain/**/*.terrain').as('terrainTile');
    cy.intercept('GET', '**/buildings-lidar-12450/content/**/*.glb').as('buildingTile');
    cy.intercept('GET', '**/mount-vernon-scene/scene.json').as('city');
    cy.intercept('GET', '**/data/cesium-regional/screening/*.json').as('screening');
    cy.visit('cesium/');
    cy.contains('h1', 'Tri-State River Valley').should('be.visible');
    cy.get('.tsm-cesium-viewport canvas', { timeout: 30000 }).should('be.visible');
    cy.wait(['@terrainTile', '@buildingTile'], { requestTimeout: 60000 }).each((hit) => {
      expect(hit.response?.statusCode).to.eq(200);
    });
    cy.get('[data-testid="cesium-terrain-status"]').should('have.attr', 'data-state', 'ready');
    cy.get('[data-testid="cesium-buildings-status"]').should('have.attr', 'data-state', 'ready');
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
});
