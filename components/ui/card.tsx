import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-subtle bg-bg-surface shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  step,
  title,
  description,
  className,
}: {
  step?: string | number;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-4 border-b border-border-subtle px-6 py-5",
        className
      )}
    >
      {step !== undefined && (
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-xs font-semibold tabular-nums text-accent">
          {typeof step === "number"
            ? String(step).padStart(2, "0")
            : step}
        </span>
      )}
      <div className="flex-1">
        <h2 className="text-base font-semibold tracking-tight text-fg-strong">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-fg-muted">{description}</p>
        )}
      </div>
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t border-border-subtle px-6 py-4",
        className
      )}
    >
      {children}
    </div>
  );
}
