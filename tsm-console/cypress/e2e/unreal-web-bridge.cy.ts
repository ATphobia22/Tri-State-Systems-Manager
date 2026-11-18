/** Public, anonymous UI acceptance. Uses only compiled source content; no live map API required. */
describe('Unreal to public web capability guide', () => {
  it('filters and expands source-linked capabilities without implying native execution', () => {
    cy.viewport(1280, 900);
    cy.visit('/platform');
    cy.contains('h2', 'Unreal Engine → Public Digital Twin').should('be.visible');
    cy.get('#unreal-web-bridge').within(() => {
      cy.contains('Showing 10 capability comparisons').should('exist');
      cy.get('#tsm-unreal-search').type('HLOD');
      cy.contains('Showing 1 capability comparisons').should('exist');
      cy.contains('summary', 'WorldPartitionEditor / World Partition HLOD Utilities').click();
      cy.contains('Published building inventory is partial').should('exist');
      cy.contains('Inspect TSM source').should('have.attr', 'href').and('include', 'github.com/ATphobia22');
      cy.contains('Epic documentation').should('have.attr', 'href').and('include', 'dev.epicgames.com');
      cy.get('#tsm-unreal-boundary').select('NATIVE_RUNTIME');
      cy.contains('No matching technologies').should('exist');
      cy.get('#tsm-unreal-search').clear();
      cy.contains('Showing 4 capability comparisons').should('exist');
    });
    cy.screenshot('unreal-web-capability-guide-public-fixture-free');
  });
});
