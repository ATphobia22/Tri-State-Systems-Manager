function setRange(selector: string, value: string) {
  cy.get(selector).then(($range) => {
    const input = $range[0] as HTMLInputElement;
    const ownerWindow = input.ownerDocument.defaultView!;
    Object.getOwnPropertyDescriptor(ownerWindow.HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new ownerWindow.Event('input', { bubbles: true }));
    input.dispatchEvent(new ownerWindow.Event('change', { bubbles: true }));
  });
}

describe('Public Cesium 4D view on the project Pages base', () => {
  it('streams terrain and buildings, draws local sources and switches replay and screening', () => {
    const renderErrors: string[] = [];
    cy.on('fail', (error) => {
      if (renderErrors.length) error.message += `\nCesium render diagnostics:\n${renderErrors.join('\n')}`;
      throw error;
    });
    cy.intercept('GET', '**/data/cesium-regional/terrain/**/*.terrain').as('terrainTile');
    cy.intercept({ method: 'GET', pathname: '**/posey-buildings/content/**/*.glb' }).as('buildingTile');
    cy.intercept({ method: 'GET', pathname: '**/posey-buildings/subtrees/**/*.subtree' }).as('buildingSubtree');
    cy.intercept('GET', '**/posey-buildings/missing-height-footprints.json').as('poseyFootprints');
    cy.intercept('GET', '**/mount-vernon-scene/scene.json').as('city');
    cy.intercept('GET', '**/data/cesium-regional/screening/*.json').as('screening');
    cy.visit('cesium/', { onBeforeLoad(win) {
      const report = win.console.error.bind(win.console);
      win.console.error = (message, ...details) => {
        if (message === 'Cesium render loop failed') {
          renderErrors.push(...details.map((detail) => detail?.message ? `${detail.message}\n${detail.stack ?? ''}` : String(detail)));
        }
        report(message, ...details);
      };
    } });
    cy.contains('h1', 'Tri-State River Valley').should('be.visible');
    cy.get('.tsm-cesium-viewport canvas', { timeout: 30000 }).should('be.visible');
    cy.get('[data-testid="cesium-tools-toggle"]').should('have.attr', 'aria-expanded', 'false').click();
    cy.get('.tsm-cesium-controls').should('be.visible');
    cy.contains('.tsm-cesium-accordion > summary', 'Regional county coverage').click();
    cy.contains('Indiana: Posey, Vanderburgh, Gibson, Warrick');
    cy.contains('Illinois: White, Gallatin');
    cy.contains('Kentucky: Henderson, Union');
    cy.get('#cesium-building-detail').should('not.be.visible');
    // Exercise camera navigation while the renderer is fresh, before slow
    // remote imagery/terrain requests. Never force interaction on a disabled
    // control: a disabled selector is a real startup or context-loss failure.
    cy.get('#cesium-place', { timeout: 30000 }).should('be.enabled');
    cy.get('#cesium-place').select('Henderson, KY');
    cy.get('.tsm-cesium-place').should('contain.text', 'Henderson, KY');
    cy.get('#cesium-place').select('Carmi, IL · White County');
    cy.get('.tsm-cesium-place').should('contain.text', 'White County');
    cy.get('#cesium-place').select('Morganfield, KY · Union County');
    cy.get('.tsm-cesium-place').should('contain.text', 'Union County');

    cy.contains('.tsm-cesium-accordion > summary', 'Map layers').click();
    cy.get('#cesium-building-detail').select('sharp').should('have.value', 'sharp');
    cy.get('#cesium-imagery-source').should('have.value', 'usgs');
    cy.wait(['@terrainTile', '@poseyFootprints', '@buildingSubtree', '@buildingTile'], { requestTimeout: 60000 }).then((hits) => {
      for (const hit of hits) expect(hit.response?.statusCode).to.eq(200);
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
    cy.contains('.tsm-cesium-accordion > summary', 'April 2025 river replay').click();
    setRange('#cesium-day', '0');
    cy.contains('output', '2025-04-01');
    cy.contains('.tsm-cesium-accordion > summary', 'Mount Vernon flood screening').click();
    cy.contains('label', 'Show hypothetical extent').find('input').check();
    cy.wait('@screening').its('response.statusCode').should('eq', 200);
    cy.get('[data-testid="cesium-screening-status"]', { timeout: 60000 }).should('contain.text', 'Screening extent on map');
    cy.get('.tsm-cesium-error').should('not.exist');
    cy.screenshot('mount-vernon-cesium-and-screening');

    cy.contains('.tsm-cesium-accordion > summary', 'Cinematic shots').click();
    cy.get('#cesium-film-shot').select('03-new-harmony');
    cy.get('.tsm-cesium-place').should('contain.text', 'New Harmony, IN');
    cy.get('label[for="cesium-day"] output').should('have.text', '2025-04-01');
    cy.get('#cesium-shot-frame').should('have.attr', 'max', '143');
    setRange('#cesium-shot-frame', '143');
    cy.get('label[for="cesium-shot-frame"] output').should('have.text', '5.96 s');
    cy.get('.tsm-cesium-error').should('not.exist');

    cy.get<HTMLCanvasElement>('.tsm-cesium-viewport canvas').then(([$canvas]) => {
      const extension = $canvas!.getContext('webgl2')?.getExtension('WEBGL_lose_context');
      expect(extension, 'Chrome WebGL context loss test extension').to.exist;
      extension!.loseContext();
      cy.get('.tsm-cesium-error').should('contain.text', 'Graphics paused');
      cy.get('#cesium-film-shot').should('be.disabled');
      cy.then(() => extension!.restoreContext());
      cy.get<HTMLCanvasElement>('.tsm-cesium-viewport canvas', { timeout: 30000 }).should(([canvas]) => {
        expect(canvas).not.to.eq($canvas);
        expect(canvas?.getContext('webgl2')?.drawingBufferWidth).to.be.greaterThan(0);
      });
    });
    cy.get('.tsm-cesium-error').should('not.exist');
    cy.get('#cesium-film-shot').should('have.value', '03-new-harmony');
    cy.get('label[for="cesium-day"] output').should('have.text', '2025-04-01');
    cy.get('label[for="cesium-shot-frame"] output').should('have.text', '5.96 s');
    cy.contains('label', 'Mount Vernon detail').find('input').should('be.checked');
    cy.get('#cesium-film-shot').select('04-flood-comparison');
    cy.get('#cesium-shot-frame').should('not.exist');
    cy.contains('Flood comparison requires a calibrated model and verified water-surface provenance.');
    cy.get('[data-testid="cesium-tools-toggle"]').click().should('have.attr', 'aria-expanded', 'false');
    cy.get('.tsm-cesium-controls').should('not.be.visible');
    cy.get('.tsm-cesium-viewport canvas').should('be.visible');
    cy.get('[data-testid="cesium-tools-toggle"]').click().should('have.attr', 'aria-expanded', 'true');
  });
  it('supports IN/IL/KY camera selection on a mobile Pages viewport', () => {
    cy.viewport(390, 844);
    cy.visit('atlas/');
    cy.get('button[aria-controls="tsm-atlas-layer-drawer"]').should('have.attr', 'aria-expanded', 'false').click();
    cy.get('button[aria-controls="tsm-atlas-layer-drawer"]').should('have.attr', 'aria-expanded', 'true');
    cy.get('#tsm-atlas-region').should('be.visible');
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
