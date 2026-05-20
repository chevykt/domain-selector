"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const disabled = selectedCount === 0 || pending;

  // Clear the success message after 5s so the button area doesn't
  // permanently look "post-export".
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 5000);
    return () => clearTimeout(t);
  }, [success]);

  function downloadXlsx() {
    setError(null);
    setSuccess(null);
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
        const filename = `${safe || "campaign"}_export.xlsx`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadurl);

        // Surface explicit confirmation. The status badge in the page header
        // will also flip SCORED → "Exported" via router.refresh, but if the
        // campaign was already FINALIZED nothing visually changes there —
        // this message is the always-visible confirmation.
        setSuccess(`Downloaded ${filename}`);

        // Defer router.refresh until AFTER this transition resolves.
        // Next.js wraps router.refresh() in its own internal transition;
        // if we call it inside our startTransition the local `pending`
        // state stays true until the route re-fetch completes, leaving
        // the button stuck on "Generating…" while the success message
        // is already visible. setTimeout(0) bumps it to the next tick
        // so the transition resolves first.
        setTimeout(() => router.refresh(), 0);
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
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Generating…
          </>
        ) : (
          `Export XLSX (${selectedCount})`
        )}
      </Button>
      {error && (
        <div role="alert" className="text-sm text-danger">
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="inline-flex items-center gap-1.5 text-sm text-success"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}
