describe('TSM light map-first navigation and controls', () => {
  beforeEach(() => {
    cy.viewport(1280, 900);
    cy.visit('/map');
    cy.contains('TRI-STATE SYSTEMS MANAGER // RIVER VALLEY ENGINEERING CONSOLE').should('exist');
  });

  it('opens accessible navigation, selects a route, and closes the drawer', () => {
    cy.get('#tsm-sidebar').should('have.attr', 'inert');
    cy.get('button[aria-controls="tsm-sidebar"]').should('have.attr', 'aria-expanded', 'false').click();
    cy.get('button[aria-controls="tsm-sidebar"]').should('have.attr', 'aria-expanded', 'true');
    cy.get('#tsm-sidebar').should('not.have.attr', 'inert');
    cy.contains('#tsm-sidebar summary', 'Explore the River Valley').click();
    cy.contains('#tsm-sidebar a', 'Hydraulic Map').click();
    cy.location('pathname').should('include', '/map');
    cy.get('button[aria-controls="tsm-sidebar"]').should('have.attr', 'aria-expanded', 'false');
  });

  it('keeps map tools closed by default and toggles an existing real layer control', () => {
    cy.get('details[aria-label="Map layers, data and engineering tools"]')
      .should('not.have.attr', 'open')
      .find('summary').click();
    cy.get('details[aria-label="Map layers, data and engineering tools"]').should('have.attr', 'open');
    cy.contains('summary', 'Map overlays and camera controls').click();
    cy.contains('button', /FEMA NFHL/).then(($button) => {
      const expected = $button.attr('aria-pressed') === 'true' ? 'false' : 'true';
      cy.wrap($button).click();
      cy.contains('button', /FEMA NFHL/).should('have.attr', 'aria-pressed', expected);
    });
    cy.contains('summary', 'Map overlays and camera controls').click();
    cy.get('details[aria-label="Map layers, data and engineering tools"]').find('summary').first().click();
    cy.get('details[aria-label="Map layers, data and engineering tools"]').should('not.have.attr', 'open');
  });

  it('supports mobile drawer dismissal using Escape without a login', () => {
    cy.viewport(390, 844);
    cy.get('button[aria-controls="tsm-sidebar"]').click();
    cy.get('button[aria-controls="tsm-sidebar"]').should('have.attr', 'aria-expanded', 'true');
    cy.get('body').trigger('keydown', { key: 'Escape', code: 'Escape', bubbles: true });
    cy.get('button[aria-controls="tsm-sidebar"]').should('have.attr', 'aria-expanded', 'false');
    cy.get('#tsm-sidebar').should('have.attr', 'inert');
    cy.contains('TSM Console Sign-In').should('not.exist');
  });
});
