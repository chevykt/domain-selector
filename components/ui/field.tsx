import * as React from "react";

import { cn } from "@/lib/utils";

/* Field — accessible form field wrapper.
   - Labels are Title Case, normal weight, fg-default for clear scan
     (was tracking-wide uppercase muted — failed WCAG and looked cramped)
   - Helper/hint text uses fg-muted (#c1c2c8 = 9:1 on bg-surface, AAA)
   - Errors use danger (with role=alert announced to AT)
*/

export function Label({
  htmlFor,
  required,
  className,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "block text-sm font-medium text-fg-default",
        className
      )}
    >
      {children}
      {required && (
        <span
          aria-label="required"
          className="ml-1 text-danger"
        >
          *
        </span>
      )}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error && (
        <p
          role="alert"
          className="text-xs leading-relaxed text-danger"
        >
          {error}
        </p>
      )}
      {!error && hint && (
        <p className="text-xs leading-relaxed text-fg-muted">{hint}</p>
      )}
    </div>
  );
}
