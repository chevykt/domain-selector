"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-2 text-xs uppercase tracking-wider text-danger">
        Error
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-fg-strong">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-fg-muted">
        An unexpected error occurred. The full details are in the server log.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-fg-subtle">
          digest: {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <a href="/">
          <Button type="button" variant="secondary">
            Back to campaigns
          </Button>
        </a>
      </div>
    </main>
  );
}
