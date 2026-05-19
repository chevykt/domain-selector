import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "block w-full rounded-md border border-border-default bg-bg-input px-3 py-2 text-sm text-fg-default shadow-sm",
      "placeholder:text-fg-disabled",
      "hover:border-border-strong focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "transition-colors",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(
      "block w-full rounded-md border border-border-default bg-bg-input px-3 py-2 text-sm text-fg-default shadow-sm",
      "placeholder:text-fg-disabled",
      "hover:border-border-strong focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "transition-colors resize-y",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  // Uses the browser's native dropdown chevron. globals.css sets
  // color-scheme to dark so the chevron renders light on the dark
  // background; no custom background-image needed here.
  <select
    ref={ref}
    className={cn(
      "block w-full rounded-md border border-border-default bg-bg-input px-3 py-2 pr-8 text-sm text-fg-default shadow-sm",
      "hover:border-border-strong focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "transition-colors",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
