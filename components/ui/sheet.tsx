"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/* Sheet — right-edge slide-out drawer built on Radix Dialog.
   Radix handles: portal, focus trap, escape key, click outside, body-scroll
   lock, a11y (role=dialog, aria-modal, focus return). We provide the
   slide-in animation via the ds-sheet-in-right keyframe in globals.css. */

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export const SheetContent = React.forwardRef<
  React.ComponentRef<typeof Dialog.Content>,
  React.ComponentPropsWithoutRef<typeof Dialog.Content>
>(({ className, children, ...props }, ref) => (
  <Dialog.Portal>
    <Dialog.Overlay
      className={cn(
        "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm",
        "[animation:ds-overlay-in_180ms_ease-out]"
      )}
    />
    <Dialog.Content
      ref={ref}
      className={cn(
        "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col",
        "border-l border-border-default bg-bg-sheet shadow-2xl",
        "[animation:ds-sheet-in-right_220ms_ease-out]",
        className
      )}
      {...props}
    >
      {children}
    </Dialog.Content>
  </Dialog.Portal>
));
SheetContent.displayName = "SheetContent";

export function SheetHeader({
  title,
  description,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-5",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <Dialog.Title className="text-lg font-semibold tracking-tight text-fg-strong">
          {title}
        </Dialog.Title>
        {description && (
          <Dialog.Description className="mt-1 text-sm text-fg-muted">
            {description}
          </Dialog.Description>
        )}
      </div>
      <Dialog.Close
        className={cn(
          "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md",
          "text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-strong",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
        )}
        aria-label="Close panel"
      >
        <X className="h-4 w-4" aria-hidden />
      </Dialog.Close>
    </div>
  );
}

export function SheetBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)}>
      {children}
    </div>
  );
}

export function SheetFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 border-t border-border-subtle px-6 py-4",
        className
      )}
    >
      {children}
    </div>
  );
}
