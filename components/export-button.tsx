"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

export function ExportButton({
  campaignId,
  campaignName,
  selectedCount,
}: {
  campaignId: string;
  campaignName: string;
  selectedCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled = selectedCount === 0 || pending;

  function downloadXlsx() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/export`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Export failed" }));
          setError(body.error ?? `HTTP ${res.status}`);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const safe = campaignName.replace(/[^A-Za-z0-9_-]+/g, "_");
        a.download = `${safe || "campaign"}_export.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Download failed");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={downloadXlsx}
        disabled={disabled}
        variant="success"
        title={
          selectedCount === 0
            ? "Select at least one domain before exporting"
            : undefined
        }
      >
        {pending ? "Generating…" : `Export XLSX (${selectedCount})`}
      </Button>
      {error && <div className="text-sm text-danger">{error}</div>}
    </div>
  );
}
