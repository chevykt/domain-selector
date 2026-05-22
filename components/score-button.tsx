"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { scoreCampaign } from "@/app/actions/score-campaign";
import { Button } from "@/components/ui/button";

export function ScoreButton({
  campaignId,
  label = "Run scoring",
  variant = "primary",
}: {
  campaignId: string;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        // The action returns as soon as it claims the lock; the actual scoring
        // runs in the background (see scoreCampaign). We just refresh so the
        // page swaps to the polling "Scoring in progress" card, which advances
        // to the shortlist on its own when scoring finishes — no reload needed.
        const r = await scoreCampaign(campaignId);
        if (r.ok) {
          router.refresh();
        } else {
          setError(r.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        router.refresh();
      }
    });
  }

  // Brief "starting" state while the action claims the lock. Once it returns,
  // the refresh swaps this out for the server-rendered progress card.
  if (pending) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-3 rounded-lg border border-accent/40 bg-accent-soft/50 px-4 py-3"
      >
        <Loader2
          className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-accent"
          aria-hidden
        />
        <div className="min-w-0">
          <div className="text-sm font-medium text-fg-strong">
            Starting scoring…
          </div>
          <div className="mt-0.5 text-xs text-fg-muted">
            Kicking off the run — the page switches to a live progress view in a
            moment.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={run} variant={variant}>
        {label}
      </Button>
      {error && (
        <div role="alert" className="text-sm text-danger">
          {error}
        </div>
      )}
    </div>
  );
}
