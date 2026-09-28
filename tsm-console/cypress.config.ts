import { defineConfig } from "cypress";

const baseUrl = process.env.CYPRESS_BASE_URL || "http://127.0.0.1:5173/";

export default defineConfig({
  e2e: {
    baseUrl,
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: false,
    viewportWidth: 1920,
    viewportHeight: 1080,
    video: true,
    screenshotOnRunFailure: true,
    setupNodeEvents(_on, config) {
      return config;
    },
    env: {
      visualRegressionType: "regression",
      visualRegressionFailSilently: false,
      visualRegressionAllowedDiffDistance: 0.01,
    },
  },
});
