import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive" | "success";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClass: Record<BadgeVariant, string> = {
  default: "tsm-badge tsm-badge-default",
  secondary: "tsm-badge tsm-badge-secondary",
  outline: "tsm-badge tsm-badge-outline",
  destructive: "tsm-badge tsm-badge-destructive",
  success: "tsm-badge tsm-badge-success",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return <span className={cn(variantClass[variant], className)} {...props} />;
}
