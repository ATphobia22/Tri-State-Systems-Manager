/** Public GPU failure must not hide the memorial or non-graphical USGS access. */
describe('Public Atlas WebGL2-independent recovery', () => {
  it('renders accessible navigation instead of throwing a route-wide WebGL error', () => {
    cy.visit('atlas/', {
      onBeforeLoad(win) {
        const original = win.HTMLCanvasElement.prototype.getContext;
        win.HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          if (type === 'webgl2') return null;
          return original.call(this, type, ...args);
        } as typeof original;
      },
    });
    cy.get('[data-testid="atlas-webgl-fallback"]').should('be.visible');
    cy.contains('4D Engineering Atlas — graphics unavailable').should('be.visible');
    cy.contains('Terrain, Cesium 3D').should('exist');
    cy.contains('NAVD88 water-surface elevations').should('exist');
    cy.get('nav[aria-label="Non-graphical public Atlas navigation"]').within(() => {
      cy.contains('Beverly Ann Tucker Memorial').should('have.attr', 'href').and('include', 'memorial');
      cy.contains('River Watch').should('have.attr', 'href').and('include', 'river-watch');
    });
    cy.contains('This view failed to load').should('not.exist');
  });

  it('preserves an independently accessible memorial route', () => {
    cy.visit('memorial');
    cy.contains('In Memory of Beverly Ann Tucker').should('be.visible');
    cy.contains('whose love for family and community inspires everything built here').should('exist');
  });
});
