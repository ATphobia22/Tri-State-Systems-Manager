import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    viewportWidth: 1280,
    viewportHeight: 720,
    supportFile: false,
    specPattern: "cypress/e2e/**/*.cy.{js,ts}",
    setupNodeEvents(on, config) {
      // Optional: configureVisualRegression(on) when cypress-visual-regression is installed
      return config;
    },
    env: {
      visualRegressionType: "regression",
      visualRegressionFailSilently: false,
      visualRegressionAllowedDiffDistance: 0.01,
    },
  },
});
