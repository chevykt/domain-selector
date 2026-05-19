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
      {error && <div className="text-sm text-danger">{error}</div>}
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
