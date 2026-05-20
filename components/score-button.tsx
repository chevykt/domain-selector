"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
      try {
        const r = await scoreCampaign(campaignId);
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
        // Server action threw or the function execution timed out at the
        // platform layer (Vercel kills functions past maxDuration). Detect
        // the timeout pattern so we can give the user a useful message
        // rather than React's generic "unexpected response" wrapper.
        const msg = err instanceof Error ? err.message : String(err);
        const isTimeout =
          msg.includes("504") ||
          msg.toLowerCase().includes("timeout") ||
          msg.toLowerCase().includes("an unexpected response");
        if (isTimeout) {
          setError(
            "Scoring took longer than the function budget allows. The run may have completed server-side — refresh the page in a moment to check. If it didn't, the inventory is likely too large for this plan and we'll need to extend the Vercel function timeout (Pro) or move scoring to a background job."
          );
          // Force a refresh so the page reads the current campaign status,
          // which will be either SCORED (if the tx committed before the
          // platform killed us) or back to INVENTORY_LOADED (if the catch
          // block in scoreCampaign released the lock).
          router.refresh();
        } else {
          setError(msg);
        }
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={run}
        disabled={pending}
        variant={variant}
      >
        {pending ? "Scoring…" : label}
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
