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
      const alert = Cypress.$('.tsm-cesium-error').text().trim();
      if (alert) error.message += `\nViewer recovery state: ${alert}`;
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
      const warn = win.console.warn.bind(win.console);
      win.console.warn = (message, ...details) => {
        if (typeof message === 'string' && message.startsWith('Cesium')) renderErrors.push(message);
        warn(message, ...details);
      };
      win.document.addEventListener('webglcontextlost', () => renderErrors.push('webglcontextlost'), true);
      win.document.addEventListener('webglcontextrestored', () => renderErrors.push('webglcontextrestored'), true);
    } });
    cy.contains('h1', 'Tri-State River Valley').should('be.visible');
    cy.get('.tsm-cesium-viewport canvas', { timeout: 30000 }).should('be.visible');
    cy.get('[data-testid="cesium-map-layers-toggle"]').should('be.visible');
    cy.get('[data-testid="cesium-tools-toggle"]').should('have.attr', 'aria-expanded', 'false').click();
    cy.get('.tsm-cesium-controls').should('be.visible');
    cy.contains('.tsm-cesium-accordion > summary', 'Regional county coverage').click();
    cy.contains('Indiana: Posey, Vanderburgh, Gibson, Warrick');
    cy.contains('Illinois: White, Gallatin');
    cy.contains('Kentucky: Henderson, Union');
    cy.get('#cesium-building-detail').should('not.be.visible');
    cy.contains('.tsm-cesium-accordion > summary', 'Map layers').click();
    cy.get('#cesium-building-detail').select('sharp').should('have.value', 'sharp');
    cy.get('#cesium-imagery-source').should('have.value', 'usgs');
    // Check camera selection while the scene is responsive, before streaming
    // many terrain and 3D tile assets. Do not force disabled controls.
    cy.get('#cesium-place', { timeout: 30000 }).should('be.enabled');
    cy.get('#cesium-place').select('Henderson, KY');
    cy.get('.tsm-cesium-place').should('contain.text', 'Henderson, KY');
    cy.get('#cesium-place').select('Carmi, IL · White County');
    cy.get('.tsm-cesium-place').should('contain.text', 'White County');
    cy.get('#cesium-place').select('Morganfield, KY · Union County');
    cy.get('.tsm-cesium-place').should('contain.text', 'Union County');

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
    // Later readiness is still a real gate: the viewer must survive tile loading.
    cy.get('#cesium-place').should('be.enabled');
    cy.get('.tsm-cesium-error').should('not.exist');
    cy.contains('.tsm-cesium-accordion > summary', 'Cinematic shots').click();
    // WebGL loss may trigger a real scene rebuild after streamed tiles arrive.
    // This is a readiness assertion, not a forced interaction.
    cy.get('#cesium-film-shot', { timeout: 30000 }).should('be.enabled');
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
    cy.contains('button', 'Show map tools').click().should('have.attr', 'aria-expanded', 'true');
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

  it('preserves the Beverly Ann Tucker memorial on a direct Pages URL', () => {
    cy.visit('memorial/');
    cy.contains('h1', 'In Memory of Beverly Ann Tucker').should('be.visible');
    cy.contains('This work is dedicated to Beverly Ann Tucker');
  });

  it('reads an explicit official USGS request on the static River Watch page', () => {
    // Fixed fixture proves the browser parser and UI, NOT a live gauge reading.
    cy.intercept('GET', '**/ogcapi/v1/collections/latest-continuous/items*', {
      statusCode: 200,
      body: {
        type: 'FeatureCollection',
        features: [{ properties: {
          monitoring_location_id: 'USGS-03378500',
          parameter_code: '00065',
          value: '1.78',
          time: '2026-11-17T09:30:00+00:00',
          unit_of_measure: 'ft',
          approval_status: 'Provisional',
        } }],
      },
    }).as('directUsgs');
    cy.visit('river-watch/');
    cy.get('#tsm-pages-gauge-select').should('be.visible').should('have.value', '03378500');
    cy.contains('button', 'Fetch current gage height (00065)').click();
    cy.wait('@directUsgs');
    cy.contains('Latest retrieved stage').should('be.visible');
    cy.contains('1.78 ft').should('exist');
    cy.contains('station gage reference ONLY').should('exist');
  });

  it('keeps the WebGL flood map exposed while controls are collapsed and expanded', () => {
    cy.visit('flood-sim/');
    cy.get('canvas[aria-label^="3D flood simulation viewport"]', { timeout: 30000 }).should('exist');
    cy.contains('button', 'Show flood settings').should('be.visible');
    cy.get('#tsm-flood-controls').should('not.be.visible');
    cy.contains('button', 'Show flood settings').click();
    cy.get('#tsm-flood-controls').should('be.visible');
    cy.contains('button', 'Hide flood settings').click();
    cy.get('#tsm-flood-controls').should('not.be.visible');
  });

  it('opens the Cesium engineering cinema without discarding the MapLibre fallback', () => {
    cy.visit('cinematic-engineering/?renderer=cesium');
    cy.get('[data-testid="engineering-renderer-toggle"]').should('have.attr', 'aria-pressed', 'true');
    cy.get('.tsm-cesium-viewport canvas', { timeout: 30000 }).should('be.visible');
    cy.get('[data-testid="cesium-buildings-quick-toggle"]', { timeout: 30000 }).should('be.enabled');
    cy.get('[data-testid="cesium-flyover-toolbar"]').should('be.enabled').click();
    cy.get('[data-testid="cesium-flyover-toolbar"]').should('contain.text', 'Stop 3D flyover').click();
    cy.contains('button', 'Show engineering settings').click();
    cy.get('#tsm-cinematic-engineering-tools').should('be.visible');
    cy.contains('button', 'Hide engineering settings').click();
    cy.get('#tsm-cinematic-engineering-tools').should('not.be.visible');
    cy.get('[data-testid="engineering-renderer-toggle"]').click().should('have.attr', 'aria-pressed', 'false');
    cy.get('canvas.maplibregl-canvas', { timeout: 30000 }).should('exist');
    cy.get('.tsm-cesium-viewport').should('not.exist');
  });

  it('renders the real cinematic engineering map with collapsible settings', () => {
    cy.visit('cinematic-engineering/');
    cy.get('canvas.maplibregl-canvas', { timeout: 30000 }).should('exist');
    cy.contains('button', 'Show engineering settings').should('be.visible');
    cy.get('#tsm-cinematic-engineering-tools').should('not.be.visible');
    cy.contains('button', 'Show engineering settings').click();
    cy.get('#tsm-cinematic-engineering-tools').should('be.visible');
    cy.contains('button', 'Hide engineering settings').click();
    cy.get('#tsm-cinematic-engineering-tools').should('not.be.visible');
    cy.contains('button', 'Play map flyover').should('exist');
  });

  it('reveals real standalone cinematic controls without covering the map', () => {
    cy.visit('cinematic/');
    cy.get('canvas.maplibregl-canvas', { timeout: 30000 }).should('exist');
    cy.contains('button', 'Show scene controls').should('be.visible');
    cy.contains('button', 'Play fly-through').should('be.visible');
    cy.contains('button', 'Show scene controls').click();
    cy.contains('button', 'Hide scene controls').should('be.visible');
    cy.contains('button', 'Hide scene controls').click();
  });

});
