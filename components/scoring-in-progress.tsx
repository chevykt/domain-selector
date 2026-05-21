"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";

/* Renders the SCORING_IN_PROGRESS state of a campaign. Polls every 3
   seconds and calls router.refresh() so the page re-fetches the
   campaign status from the server. When the server-side action
   completes the status flips to SCORED and the page re-renders the
   shortlist instead of this card. */

export function ScoringInProgress({
  startedAt,
  inventoryCount,
}: {
  startedAt: Date;
  inventoryCount: number;
}) {
  const router = useRouter();
  // Hold "now" in state so render stays pure (no Date.now() during render).
  // Initialized from the startedAt prop, then synced to the real clock on mount.
  const [now, setNow] = useState(() => startedAt.getTime());

  // Poll the server every 3s; status flips to SCORED when scoring finishes.
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [router]);

  // Tick the elapsed-time display every second. setNow is only called inside
  // the interval callback (never synchronously in the effect body), so render
  // stays pure and we avoid cascading renders.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const secondsAgo = Math.max(0, Math.floor((now - startedAt.getTime()) / 1000));

  return (
    <Card>
      <CardHeader
        step="B"
        title="Scoring in progress"
        description="Safe to leave this tab. The page updates automatically when scoring finishes."
      />
      <CardBody>
        <div className="flex items-center gap-4">
          <Loader2
            className="h-6 w-6 shrink-0 animate-spin text-accent"
            aria-hidden
          />
          <div className="min-w-0 text-sm">
            <div className="text-fg-default">
              Scoring {inventoryCount.toLocaleString()} domains against the
              active config…
            </div>
            <div className="mt-0.5 text-xs text-fg-muted">
              Started{" "}
              {secondsAgo < 60
                ? `${secondsAgo}s ago`
                : `${Math.floor(secondsAgo / 60)}m ${secondsAgo % 60}s ago`}
              {" · polling every 3s"}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
