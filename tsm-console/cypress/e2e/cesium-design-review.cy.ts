/** Headed browser smoke of the local-only BIM review. All inputs are synthetic. */
const fixture = (revisionId: string, hash: string, amount: number) => ({
  schema: 'tsm.design-review.v1',
  modelId: 'test-bridge', revisionId,
  source: {sourceId:'synthetic-only',sha256:hash.repeat(64),
    horizontalCrs:'EPSG:2966',horizontalUnits:'ftUS',verticalDatum:'UNVERIFIED',license:'synthetic-only'},
  placement: {state:'PENDING_EVIDENCE',controlCount:0,maxResidualM:null,toleranceM:null},
  elements: [
    {id:'root',parentId:null,title:'Root Assembly',category:'Assembly',quantities:{}},
    {id:'girder',parentId:'root',title:'Example Girder',category:'Beam',quantities:{
      volume:{value:amount,unit:'m3',evidence:'DERIVED'}}},
    {id:'unknown',parentId:'root',title:'Unverified Slab',category:'Slab',quantities:{
      volume:{value:100,unit:'m3',evidence:'UNVERIFIED'}}},
  ],
});
function load(data: unknown) {
  cy.get('#cesium-design-file').selectFile({contents:Cypress.Buffer.from(JSON.stringify(data)),
    fileName:'synthetic-review.json',mimeType:'application/json'});
}
function setup() {
  cy.visit('cesium/');
  cy.get('[data-testid="cesium-tools-toggle"]').click();
  cy.get('[data-testid="cesium-design-review"] > summary').click();
}
describe('Local BIM review and public education', () => {
  it('loads locally, excludes unverified values and compares revisions', () => {
    setup(); load(fixture('a','a',12.5));
    cy.contains('test-bridge').should('be.visible');
    cy.get('[data-testid="cesium-design-quantity"]').should('contain.text','12.5 m3')
      .and('contain.text','omitted 2');
    cy.get('#cesium-design-search').type('girder');
    cy.get('#cesium-design-element').select('girder');
    cy.contains('Element ID: girder').should('be.visible');
    cy.contains('button','Save current revision as comparison baseline').click();
    load(fixture('b','b',17.5));
    cy.contains('button','Compare to saved baseline').click();
    cy.get('[data-testid="cesium-design-diff"]').should('contain.text','modified 1');
    cy.get('[data-testid="cesium-design-quantity"]').should('contain.text','17.5 m3');
  });
  it('rejects an unsupported CRS before populating the review', () => {
    setup();const data=fixture('c','c',7);data.source.horizontalCrs='unknown';
    load(data);
    cy.get('[role="alert"]').should('contain.text','horizontalCrs');
    cy.get('[data-testid="cesium-design-quantity"]').should('not.exist');
  });
  it('marks flood screening as hypothetical', () => {
    cy.visit('cesium/');
    cy.get('[data-testid="cesium-tools-toggle"]').click();
    cy.get('[data-testid="cesium-learning-lab"] > summary').click();
    cy.contains('Flood screening is a demonstration').should('be.visible');
  });
});
