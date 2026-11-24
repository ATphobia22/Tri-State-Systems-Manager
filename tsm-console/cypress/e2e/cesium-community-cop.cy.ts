/** Browser local-import behavior; synthetic data is not source evidence. */
const sample = () => ({
  type: 'FeatureCollection', schema: 'tsm.community-cop.v1',
  publicPublication: 'REVIEW_REQUIRED', engineeringUse: 'NOT_VALIDATED',
  runtime: 'FILES_ONLY_NO_SERVER', navd88WseIncluded: false, hydraulicSimulationIncluded: false,
  capturedAt: '2025-01-01T12:01:00Z', readAt: '2025-01-01T12:01:00Z', staleAfterSeconds: 3600,
  stations: {
    'USGS-03322000': {sourceStatus:'SOURCE_UNAVAILABLE',seriesCount:0,unlocatedSeriesCount:0},
    'USGS-03377500': {sourceStatus:'NOT_IN_CAPTURE',seriesCount:0,unlocatedSeriesCount:0},
    'USGS-03378500': {sourceStatus:'CAPTURED',seriesCount:1,unlocatedSeriesCount:0},
  },
  features: [{
    type:'Feature', geometry:{type:'Point',coordinates:[-87.9,38.1]},
    properties:{stationId:'USGS-03378500',authority:'USGS',sourceStatus:'CAPTURED',
      verticalReference:'STATION_GAGE_DATUM_UNRESOLVED',timeSeriesId:'synthetic-only',
      eventId:'fixture-event',sourceSha256:'a'.repeat(64),
      observedAt:'2025-01-01T12:00:00Z',gageHeightFt:8.5},
  }],
});
describe('Community river observation import', () => {
  it('loads local observations, preserves unavailable sources and rejects false vertical authority', () => {
    cy.visit('cesium/');
    cy.get('[data-testid="cesium-tools-toggle"]').click();
    const panel = '[data-testid="cesium-community-cop"]';
    cy.get(panel+' > summary').click();
    const load = (data: unknown) => cy.get('#cesium-cop-file').selectFile({
      contents:Cypress.Buffer.from(JSON.stringify(data)),fileName:'synthetic.geojson',mimeType:'application/geo+json',
    });
    load(sample());
    cy.get(panel).should('contain.text','USGS-03322000 · SOURCE_UNAVAILABLE')
      .and('contain.text','USGS-03377500 · NOT_IN_CAPTURE')
      .and('contain.text','USGS-03378500 · CAPTURED')
      .and('contain.text','source not independently verified here');
    load({...sample(),navd88WseIncluded:true});
    cy.get(panel).find('[role="alert"]').should('contain.text','Invalid COP snapshot');
    cy.get(panel).should('contain.text','USGS-03378500 · CAPTURED');
    cy.contains('button','Clear observation layer').click();
    cy.get(panel).should('not.contain.text','USGS-03378500 · CAPTURED');
  });
});
