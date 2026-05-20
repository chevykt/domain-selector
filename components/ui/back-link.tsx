import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

/* Pill-style back navigation. Replaces plain "← Back to campaigns" text
   links across pages. Cyan accent on hover so it reads as a deliberate
   interactive affordance, not just inline body copy. */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border-default bg-bg-surface px-3 py-1 text-xs font-medium text-fg-muted transition-colors",
        "hover:border-accent hover:bg-accent-soft hover:text-accent",
        "focus-visible:border-accent focus-visible:bg-accent-soft focus-visible:text-accent focus-visible:outline-none",
        className
      )}
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      {children}
    </Link>
  );
}
