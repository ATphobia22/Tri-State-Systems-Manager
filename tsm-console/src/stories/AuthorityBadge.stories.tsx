import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "@/components/ui/badge";

/**
 * Lightweight story for trust-fabric badges used near AuthorityBadge.
 * Full AuthorityBadge.tsx remains the production component.
 */
function AuthorityBadgePreview(props: { label: string; variant: "default" | "success" | "destructive" | "outline" }) {
  return <Badge variant={props.variant}>{props.label}</Badge>;
}

const meta: Meta<typeof AuthorityBadgePreview> = {
  title: "TSM/AuthorityBadgePreview",
  component: AuthorityBadgePreview,
};
export default meta;

type Story = StoryObj<typeof AuthorityBadgePreview>;

export const Regulatory: Story = {
  args: { label: "REGULATORY · NFHL", variant: "default" },
};

export const Observation: Story = {
  args: { label: "OBSERVATION · USGS", variant: "outline" },
};

export const HumanRequired: Story = {
  args: { label: "HUMAN REVIEW REQUIRED", variant: "destructive" },
};

export const Approved: Story = {
  args: { label: "HUMAN AUTHORIZED", variant: "success" },
};
