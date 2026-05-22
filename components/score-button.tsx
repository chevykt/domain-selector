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
  const [result, setResult] = useState<{
    qualified: number;
    disqualified: number;
    totalDomains: number;
    configVersionNumber: number;
  } | null>(null);

  function run() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      // Don't trust the action's response indefinitely. A long or dropped
      // response (e.g. a slow run, or a connection cut by an intermediary)
      // would otherwise leave this spinner up forever — even though the server
      // keeps running the action to completion. After FALLBACK_MS we stop
      // waiting and refresh to the server's real state: the polling
      // "Scoring in progress" card if it's still running, or the finished
      // shortlist if it already completed.
      const FALLBACK_MS = 12_000;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const fallback = new Promise<"fallback">((resolve) => {
        timer = setTimeout(() => resolve("fallback"), FALLBACK_MS);
      });
      try {
        const r = await Promise.race([scoreCampaign(campaignId), fallback]);
        if (r === "fallback") {
          // Hand off to the server-rendered state; the run finishes on its own.
          router.refresh();
          return;
        }
        if (r.ok) {
          setResult({
            qualified: r.qualified,
            disqualified: r.disqualified,
            totalDomains: r.totalDomains,
            configVersionNumber: r.configVersionNumber,
          });
          router.refresh();
        } else {
          setError(r.error);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isTimeout =
          msg.includes("504") ||
          msg.toLowerCase().includes("timeout") ||
          msg.toLowerCase().includes("an unexpected response");
        if (isTimeout) {
          setError(
            "Scoring took longer than the function budget allows. Refresh the page in a moment — the run may have completed server-side."
          );
          router.refresh();
        } else {
          setError(msg);
        }
      } finally {
        if (timer) clearTimeout(timer);
      }
    });
  }

  // When pending, show a prominent loading panel instead of just a tiny
  // "Scoring…" button label. This is what users actually see during the
  // 5-10s scoring window — the server-side SCORING_IN_PROGRESS state
  // doesn't reach the client mid-action (revalidatePath only fires after
  // the action returns), so the client has to draw its own loading UI.
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
            Scoring in progress…
          </div>
          <div className="mt-0.5 text-xs text-fg-muted">
            Running the deterministic engine across every domain. This usually
            takes 5–15 seconds.
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
      {result && (
        <div className="text-sm text-fg-muted">
          Scored {result.totalDomains.toLocaleString()} domains using config v
          {result.configVersionNumber}.{" "}
          <span className="font-medium text-fg-default">
            {result.qualified}
          </span>{" "}
          qualified ·{" "}
          <span className="font-medium text-fg-default">
            {result.disqualified}
          </span>{" "}
          disqualified.
        </div>
      )}
    </div>
  );
}
