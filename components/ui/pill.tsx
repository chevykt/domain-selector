"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// A single multi-select pill. Click to toggle. Used inline as a row of options.
export function Pill({
  label,
  selected,
  onToggle,
  disabled,
  className,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
        selected
          ? "border-accent bg-accent-soft text-accent"
          : "border-border-default bg-bg-input text-fg-muted hover:border-border-strong hover:text-fg-default",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {label}
    </button>
  );
}

// A whole pill-group. Items can be objects so we can have value !== label.
export interface PillOption<T extends string> {
  value: T;
  label: string;
}

export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
  className,
}: {
  options: readonly PillOption<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const set = new Set(value);
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const isSelected = set.has(opt.value);
        return (
          <Pill
            key={opt.value}
            label={opt.label}
            selected={isSelected}
            disabled={disabled}
            onToggle={() => {
              const next = new Set(value);
              if (isSelected) next.delete(opt.value);
              else next.add(opt.value);
              onChange(Array.from(next) as T[]);
            }}
          />
        );
      })}
    </div>
  );
}
