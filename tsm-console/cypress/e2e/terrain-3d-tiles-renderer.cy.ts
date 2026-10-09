describe("TSM generated 3D Tiles renderer", () => {
  beforeEach(() => {
    Cypress.on("uncaught:exception", (error) => {
      // Cypress cannot expose stack traces for exceptions surfaced by
      // cross-origin WebGL/module execution. Do not suppress ordinary
      // application failures; only suppress the wrapper so the smoke page's
      // explicit ready/error state remains the authoritative assertion.
      return error.message === "Script error." || error.message.includes("cross origin script");
    });
  });

  it("loads the registered terrain tileset and at least one GLB", () => {
    cy.visit("terrain-3d-tiles-renderer-smoke.html");
    // Software WebGL (SwiftShader) in CI compiles shaders slowly; allow up to
    // 60s for the page's own 45s render deadline to report ready/error/timeout.
    cy.get("#status", { timeout: 60000 })
      .should("have.attr", "data-state")
      .and("match", /^ready:tileset=1;models=[1-9][0-9]*$/);
  });

  it("renders the public self-hosted Cesium terrain route", () => {
    cy.visit("/");
    cy.contains("a", "3D Terrain (3DEP)", { timeout: 30000 }).click();
    cy.get('[data-renderer-state="ready"]', { timeout: 90000 })
      .should("be.visible");
    cy.get('[aria-label="Interactive 3D terrain viewer"]').should("be.visible");
  });
});
