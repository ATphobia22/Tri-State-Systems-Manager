import type { Meta, StoryObj } from "@storybook/react";
import { LomaLagBfeChecklist } from "@/components/LomaLagBfeChecklist";

const meta: Meta<typeof LomaLagBfeChecklist> = {
  title: "TSM/LomaLagBfeChecklist",
  component: LomaLagBfeChecklist,
};
export default meta;

type Story = StoryObj<typeof LomaLagBfeChecklist>;

export const BonebankWorking: Story = {
  args: {
    lagFtNavd88: 377.2,
    bfeFtNavd88: 369.1,
    firmPanel: "18129C0300C",
    fillPlaced: false,
    humanReviewed: false,
  },
};

export const BelowBfe: Story = {
  args: {
    lagFtNavd88: 368.0,
    bfeFtNavd88: 369.1,
    firmPanel: "18129C0300C",
    fillPlaced: false,
    humanReviewed: false,
  },
};

export const FillPath: Story = {
  args: {
    lagFtNavd88: 378.0,
    bfeFtNavd88: 369.1,
    firmPanel: "18129C0300C",
    fillPlaced: true,
    humanReviewed: true,
  },
};
