import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "default" | "secondary" | "outline" | "destructive" | "ghost";
export type ButtonSize = "default" | "sm" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClass: Record<ButtonVariant, string> = {
  default: "tsm-btn tsm-btn-default",
  secondary: "tsm-btn tsm-btn-secondary",
  outline: "tsm-btn tsm-btn-outline",
  destructive: "tsm-btn tsm-btn-destructive",
  ghost: "tsm-btn tsm-btn-ghost",
};

const sizeClass: Record<ButtonSize, string> = {
  default: "tsm-btn-md",
  sm: "tsm-btn-sm",
  lg: "tsm-btn-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(variantClass[variant], sizeClass[size], className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
