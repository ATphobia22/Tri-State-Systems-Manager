describe('TSM unified visualization navigation', () => {
  beforeEach(() => {
    cy.viewport(1280, 900);
    cy.visit('/map');
  });

  it('switches existing view routes without authentication', () => {
    cy.get('select[aria-label="Choose visualization"]').should('have.value', '/map');
    cy.get('select[aria-label="Choose visualization"]').select('/atlas');
    cy.location('pathname').should('include', '/atlas');
    cy.get('select[aria-label="Choose visualization"]').should('have.value', '/atlas');
    cy.contains('TSM Console Sign-In').should('not.exist');
  });

  it('preserves advanced viewers while simplifying the exploration menu', () => {
    cy.get('button[aria-controls="tsm-sidebar"]').click();
    cy.contains('#tsm-sidebar summary', 'Explore the River Valley').click();
    cy.contains('#tsm-sidebar a', 'Hydraulic Map').should('exist');
    cy.contains('#tsm-sidebar summary', 'Advanced viewers & engines').click();
    cy.contains('#tsm-sidebar a', 'Cesium 3D Buildings').should('exist');
    cy.contains('#tsm-sidebar a', '3D Terrain (3DEP)').should('exist');
  });
});
