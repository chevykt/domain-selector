import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/* Recessed input pattern:
   - bg-input is darker than the surrounding card (creates "well" effect)
   - shadow-inner adds the depressed feel
   - hover brightens the border
   - focus: cyan border + ring (40% alpha halo) for clear keyboard focus state */
const inputBase = cn(
  "block w-full rounded-md text-sm",
  "bg-bg-input text-fg-strong placeholder:text-fg-disabled",
  "border border-border-default",
  "shadow-[inset_0_1px_0_0_rgba(0,0,0,0.4)]",
  "transition-colors duration-150",
  "hover:border-border-strong",
  "focus:border-accent focus:outline-none",
  "focus:ring-2 focus:ring-accent-ring focus:ring-offset-0",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(inputBase, "px-3 py-2", className)}
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
    className={cn(inputBase, "px-3 py-2 resize-y", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

/* Select wraps the native <select> with a lucide chevron rendered absolutely
   on top. Native control retains all OS keyboard behavior and a11y; chevron
   is purely cosmetic (aria-hidden) so it never confuses screen readers. */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        inputBase,
        "appearance-none px-3 py-2 pr-9 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      aria-hidden
      className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
    />
  </div>
));
Select.displayName = "Select";
