import type { StorybookConfig } from "storybook";

/**
 * Storybook config — optional CI job.
 * Does not run inside the production Vite bundle.
 */
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: false,
  },
};

export default config;
