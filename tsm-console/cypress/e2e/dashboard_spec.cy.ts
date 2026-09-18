describe("PTDT v35 Dashboard - E2E Integration Suite", () => {
  beforeEach(() => {
    cy.visit("/", {
      onBeforeLoad(win) {
        // The production console requires OIDC authentication. Keep browser
        // capabilities deterministic in CI without fabricating an identity.
        if (!(win.navigator as Navigator & { gpu?: unknown }).gpu) {
          Object.defineProperty(win.navigator, "gpu", {
            value: undefined,
            configurable: true,
          });
        }
      },
    });
  });

  it("allows anonymous public read access to the engineering console", () => {
    cy.location("pathname").should("eq", "/");
    cy.get("body").should("contain.text", "Beverly Ann Tucker Memorial Stewardship Charter");
    cy.get("body").should("not.contain.text", "TSM Console Sign-In");
  });

  it("does not require WebGPU for the unauthenticated shell", () => {
    cy.get("body").should("exist");
    cy.get("canvas").should("not.exist");
  });
});
