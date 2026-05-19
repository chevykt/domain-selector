"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

export function ExportButton({
  campaignId,
  campaignName,
  selectedCount,
  domainIds,
}: {
  campaignId: string;
  campaignName: string;
  selectedCount: number;
  // Restricts the export to these domain IDs. When omitted, the route falls
  // back to exporting every included Selection in the DB. Shortlist passes
  // the IDs of the currently visible+selected rows so the export honours
  // the dedupe filter ("what you see is what you export").
  domainIds?: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled = selectedCount === 0 || pending;

  function downloadXlsx() {
    setError(null);
    startTransition(async () => {
      try {
        const url = new URL(
          `/api/campaigns/${campaignId}/export`,
          window.location.origin
        );
        if (domainIds && domainIds.length > 0) {
          url.searchParams.set("domainIds", domainIds.join(","));
        }
        const res = await fetch(url.toString());
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Export failed" }));
          setError(body.error ?? `HTTP ${res.status}`);
          return;
        }
        const blob = await res.blob();
        const downloadurl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadurl;
        const safe = campaignName.replace(/[^A-Za-z0-9_-]+/g, "_");
        a.download = `${safe || "campaign"}_export.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadurl);
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
