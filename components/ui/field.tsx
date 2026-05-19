import * as React from "react";

import { cn } from "@/lib/utils";

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
        "block text-xs font-medium uppercase tracking-wide text-fg-muted",
        className
      )}
    >
      {children}
      {required && <span className="ml-1 text-danger">*</span>}
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
      {(hint || error) && (
        <p
          className={cn(
            "text-xs leading-relaxed",
            error ? "text-danger" : "text-fg-subtle"
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-fg-subtle">{children}</p>;
}
