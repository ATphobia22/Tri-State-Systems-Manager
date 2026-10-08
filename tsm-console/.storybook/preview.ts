import type { Preview } from "storybook";
import "../src/styles/shadcn-primitives.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { expanded: true },
  },
};

export default preview;
