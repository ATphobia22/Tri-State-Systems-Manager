describe('Source-governed regional Atlas navigation and startup', () => {
  beforeEach(() => {
    cy.viewport(1280, 900);
  });

  it('decodes Plus Codes offline while preserving civil-engineering disclaimers', () => {
    cy.visit('atlas/');
    cy.contains('button', 'Show map tools').then(($button) => {
      if ($button.attr('aria-expanded') === 'false') cy.wrap($button).click();
    });
    cy.get('.tsm-atlas-plus-code summary').click();
    cy.get('#tsm-atlas-plus-code-hint code').invoke('text').then((validCode) => {
      cy.get('#tsm-atlas-plus-code').type('invalid');
      cy.contains('button', 'Go to Plus Code').click();
      cy.get('.tsm-atlas-location-error').should('contain.text', 'full Plus Code');
      cy.get('#tsm-atlas-plus-code').clear().type(validCode);
      cy.contains('button', 'Go to Plus Code').click();
      cy.get('#tsm-atlas-region').should('have.value', 'plus-code');
      cy.get('[data-testid="atlas-region-title"]').should('contain.text', validCode);
      cy.get('.tsm-atlas-region-note').should('contain.text', 'not a surveyed point');
    });
    cy.contains('.tsm-atlas-map-layers', 'live tile/feature fetch unverified').should('exist');
    cy.get('.tsm-atlas-source-legend').should('contain.text', 'regulatory floodplain');
    cy.contains('.tsm-atlas-stage-toolbar a', 'Cesium 3D viewer').should('have.attr', 'href').and('include', 'cesium');
    cy.contains('.tsm-atlas-stage-toolbar label', 'Posey 3D buildings').find('input').should('exist');
  });

  it('does not pretend a blocked OpenFreeMap style is real imagery', () => {
    cy.intercept({method: 'GET', url: /^https:\/\/tiles\.openfreemap\.org\/styles\/liberty(?:\?.*)?$/ }, { forceNetworkError: true });
    cy.visit('atlas/');
    cy.get('.tsm-atlas-map-status', { timeout: 30000 })
      .should('contain.text', 'Neutral map fallback loaded');
    cy.get('canvas.maplibregl-canvas').should('be.visible');
    cy.get('.tsm-atlas-map-status').should('contain.text', 'terrain, tiles and vertical datum remain unverified');
  });
});
