import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind-aware class composer. Use everywhere we conditionally compose
// class names so later classes win conflicts predictably.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Format a number with comma thousands separators. Returns "—" for null.
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
