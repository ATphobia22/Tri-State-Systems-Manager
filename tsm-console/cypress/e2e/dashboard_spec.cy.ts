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

  it("protects the engineering console with the OIDC login boundary", () => {
    cy.location("pathname").should("eq", "/login");
    cy.get("#login-title").should("contain", "TSM Console Sign-In");
    cy.contains("Continue with Keycloak").should("be.visible");
  });

  it("does not require WebGPU for the unauthenticated shell", () => {
    cy.get("body").should("exist");
    cy.get("canvas").should("not.exist");
  });
});
