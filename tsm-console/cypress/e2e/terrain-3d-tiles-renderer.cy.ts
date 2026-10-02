describe("TSM generated 3D Tiles renderer", () => {
  beforeEach(() => {
    Cypress.on("uncaught:exception", (error) => {
      // Cypress cannot expose stack traces for exceptions surfaced by
      // cross-origin WebGL/module execution. Do not suppress ordinary
      // application failures; only suppress the wrapper so the smoke page's
      // explicit ready/error state remains the authoritative assertion.
      return error.message.includes("cross origin script");
    });
  });

  it("loads the registered terrain tileset and at least one GLB", () => {
    cy.visit("terrain-3d-tiles-renderer-smoke.html");
    cy.get("#status", { timeout: 20000 })
      .should("have.attr", "data-state")
      .and("match", /^ready:tileset=1;models=[1-9][0-9]*$/);
  });
});
