describe("PTDT v35 Dashboard - E2E Integration Suite", () => {
  beforeEach(() => {
    cy.visit("/", {
      onBeforeLoad(win) {
        // Keep browser capabilities deterministic in CI without fabricating an identity.
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
    cy.location("pathname").should("match", /\/$/);
    cy.get("body").should("contain.text", "Community Stewardship Charter");
    cy.get("body").should("not.contain.text", "TSM Console Sign-In");
  });

  it("resolves production assets under the configured deployment base path", () => {
    cy.document().then((document) => {
      const assets = Array.from(
        document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
          "script[src], link[href]",
        ),
      )
        .map((element) => element.getAttribute("src") ?? element.getAttribute("href"))
        .filter((value): value is string => Boolean(value))
        .filter((value) => !value.startsWith("data:") && !value.startsWith("http"));

      expect(assets.length).to.be.greaterThan(0);
      const basePath = new URL("./", document.baseURI).pathname;

      assets.forEach((asset) => {
        const resolved = new URL(asset, document.baseURI);
        expect(
          resolved.pathname.startsWith(basePath),
          `asset ${asset}`,
        ).to.equal(true);
      });
    });

    cy.window().then((win) => {
      expect(win.performance.getEntriesByType("resource")).to.not.be.empty;
    });
  });

  it("supports public deep-link navigation for map, EOC, and twin routes", () => {
    const routes = ["/map", "/eoc", "/twin"];

    routes.forEach((route) => {
      cy.visit(route);
      cy.location("pathname").should("include", route);
      cy.get("body").should("exist");
      cy.get("body").should("not.contain.text", "TSM Console Sign-In");
    });
  });

  it("does not require WebGPU for the unauthenticated shell", () => {
    cy.get("body").should("exist");
    cy.get("canvas").should("not.exist");
  });
});
