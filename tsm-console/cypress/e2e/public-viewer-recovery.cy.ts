/** Browser acceptance with stubbed USGS response: no fabricated live observations. */
describe('Public gauge, memorial and unobstructed cinematic controls', () => {
  it('explains initial global telemetry separately from manual station snapshots', () => {
    cy.visit('/map');
    cy.contains('No river observation is preloaded in the global status context.').should('exist');
    cy.contains('Use the River Watch or map gauge controls to request official USGS snapshots').should('exist');
    cy.contains('Live hydrologic telemetry unavailable.').should('not.exist');
  });

  it('shows a source-labeled USGS stage from the official OGC request shape', () => {
    cy.intercept('GET', '**/data/tsm-river-gauge-locations.geojson').as('stations');
    cy.intercept('GET', 'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items*', (request) => {
      expect(request.url).to.include('monitoring_location_id=USGS-03378500');
      expect(request.url).to.include('parameter_code=00065');
      // Test fixture only: these values are not represented as a live feed.
      request.reply({ statusCode: 200, body: {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {
          monitoring_location_id: 'USGS-03378500', parameter_code: '00065',
          value: '1.78', unit_of_measure: 'ft',
          time: '2026-11-17T12:30:00+00:00',
          approval_status: 'Provisional', qualifier: null,
        } }],
      } });
    }).as('currentStage');
    cy.visit('/river-watch');
    cy.wait('@stations');
    cy.contains('button', 'Fetch current gage height (00065)').should('be.enabled').click();
    cy.wait('@currentStage');
    cy.contains('Latest retrieved stage').should('be.visible');
    cy.contains('1.78 ft').should('be.visible');
    cy.contains('2026-11-17T12:30:00+00:00').should('exist');
    cy.contains('Provisional').should('exist');
    cy.contains('no NAVD88 conversion').should('exist');
  });

  it('shows real-source USGS stage by explicit operator fallback when Pages has no API server', () => {
    // All numeric readings here are TEST FIXTURES, not live authoritative data.
    const fixtureObservedAt = new Date(Date.now() - 60_000).toISOString();
    cy.intercept('GET', '**/api/hydrologic/community*', {statusCode:503, body:{error:'API unavailable in static public site'}}).as('noServer');
    cy.intercept('GET', 'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items*', (request) => {
      const site = new URL(request.url).searchParams.get('monitoring_location_id');
      const allowed = ['USGS-03378500','USGS-03322000','USGS-03322420'];
      expect(allowed).to.include(site);
      request.reply({statusCode:200, headers:{'access-control-allow-origin':'*'}, body: {
        type:'FeatureCollection',
        features:[
          {type:'Feature',properties:{
            monitoring_location_id:site, parameter_code:'00065',
            time:fixtureObservedAt, unit_of_measure:'ft',
            value:site === 'USGS-03378500' ? '13.25' : '8.15',
            approval_status:'Provisional',
          }},
        ],
      }});
    }).as('directUSGS');
    cy.visit('/map');
    cy.get('details[aria-label="Map layers, data and engineering tools"] > summary').click();
    cy.get('[role="region"][aria-label="Multi-station water levels"]')
      .contains('button', 'Fetch all local water levels').click();
    cy.wait('@noServer');
    cy.wait(['@directUSGS','@directUSGS','@directUSGS']);
    cy.get('[role="region"][aria-label="Multi-station water levels"]').within(() => {
      cy.contains('13.25 ft').should('be.visible');
      cy.contains('03322000').should('exist');
      cy.contains('03322420').should('exist');
      cy.contains('unavailable').should('exist'); // no invented NAVD88
      cy.contains('All stations unavailable').should('not.exist');
    });
    cy.screenshot('usgs-direct-map-fallback-synthetic-observations');
  });

  it('loads the Beverly Ann Tucker memorial directly and preserves its dedication', () => {
    cy.visit('/memorial');
    cy.contains('h1', 'In Memory of Beverly Ann Tucker').should('be.visible');
    cy.contains('whose love for family and community inspires everything built here').should('exist');
  });

  it('defaults to a clear cinematic viewport with reversible model and music disclosures', () => {
    cy.visit('/cinematic-engineering');
    cy.contains('button', 'Show engineering settings').should('have.attr', 'aria-expanded', 'false');
    cy.contains('button', 'Show model labels').should('have.attr', 'aria-pressed', 'false');
    cy.get('#tsm-cinema-model-overlay').should('not.exist');
    cy.get('.maplibregl-canvas', { timeout: 30000 }).should('exist');
    cy.contains('button', 'Show model labels').click();
    cy.get('#tsm-cinema-model-overlay').should('exist');
    cy.contains('button', 'Hide model labels').click();
    cy.get('#tsm-cinema-model-overlay').should('not.exist');
    cy.get('button[aria-label="Expand music controls"]').should('be.visible').click();
    cy.get('button[aria-label="Collapse music controls"]').should('be.visible').click();
    cy.get('button[aria-label="Expand music controls"]').should('be.visible');
  });
});
