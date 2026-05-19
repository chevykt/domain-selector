"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { uploadInventory } from "@/app/actions/upload-inventory";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export function InventoryUpload({
  campaignId,
  existingFilename,
  existingRowCount,
  existingSkippedRows,
}: {
  campaignId: string;
  existingFilename?: string | null;
  existingRowCount?: number | null;
  existingSkippedRows?: number | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    filename: string;
    rowCount: number;
    skippedHeaderRows: number;
    warnings: string[];
  } | null>(null);

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const r = await uploadInventory(campaignId, formData);
      if (r.ok) {
        setResult({
          filename: file.name,
          rowCount: r.rowCount,
          skippedHeaderRows: r.skippedHeaderRows,
          warnings: r.warnings,
        });
        router.refresh();
      } else {
        let msg = r.error;
        if (r.details?.missing && r.details.missing.length > 0) {
          msg = `${r.error} — missing: ${r.details.missing.join(", ")}`;
        }
        setError(msg);
      }
    });
  }

  return (
    <Card>
      <CardHeader
        step="A"
        title="Vendor inventory"
        description="Upload the BlueTree paid-sites CSV export. Summary rows at the top of the file are skipped automatically."
      />
      <CardBody className="space-y-4">
        {existingFilename && !result && (
          <div className="rounded-lg border border-border-subtle bg-bg-elevated px-4 py-3 text-sm">
            <div className="font-medium text-fg-strong">{existingFilename}</div>
            <div className="mt-0.5 text-xs text-fg-muted">
              {formatNumber(existingRowCount)} domain rows ·{" "}
              {existingSkippedRows ?? 0} summary rows skipped
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            onChange={onSelect}
            disabled={pending}
            className="block text-sm text-fg-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-fg hover:file:bg-accent-hover disabled:opacity-60"
          />
          {pending && (
            <span className="text-xs text-fg-muted">Parsing…</span>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-success/40 bg-success-soft px-4 py-3 text-sm text-success">
            <div className="font-medium">{result.filename} uploaded.</div>
            <div className="mt-0.5 text-xs opacity-90">
              {formatNumber(result.rowCount)} domains kept ·{" "}
              {result.skippedHeaderRows} summary rows skipped
            </div>
            {result.warnings.length > 0 && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer opacity-80">
                  {result.warnings.length} warning(s)
                </summary>
                <ul className="ml-4 mt-1 list-disc">
                  {result.warnings.slice(0, 10).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
