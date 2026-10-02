describe("TSM generated 3D Tiles renderer", () => {
  it("loads the registered terrain tileset and at least one GLB", () => {
    cy.visit("terrain-3d-tiles-renderer-smoke.html");
    cy.get("#status", { timeout: 20000 })
      .should("have.attr", "data-state")
      .and("match", /^ready:tileset=1;models=[1-9][0-9]*$/);
  });
});
