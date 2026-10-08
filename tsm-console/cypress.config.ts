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
    setupNodeEvents(on, config) {
      on("before:browser:launch", (browser, launchOptions) => {
        // Software WebGL rendering for CI environments without GPU
        // Uses SwiftShader for WebGL via ANGLE
        if (browser.name === "chrome" || browser.name === "chromium") {
          launchOptions.args.push("--use-gl=angle");
          launchOptions.args.push("--use-angle=swiftshader");
          launchOptions.args.push("--enable-unsafe-swiftshader");
          launchOptions.args.push("--disable-gpu-sandbox");
          launchOptions.args.push("--no-sandbox");
        }
        return launchOptions;
      });
      return config;
    },
    env: {
      visualRegressionType: "regression",
      visualRegressionFailSilently: false,
      visualRegressionAllowedDiffDistance: 0.01,
    },
  },
});
