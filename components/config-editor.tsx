"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";

import { saveConfigVersion } from "@/app/actions/save-config-version";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { ConfigSnapshotSchema } from "@/lib/config/types";

/* Editor for a ConfigVersion snapshot.
   Pre-fills the JSON textarea with the currently active snapshot so the
   user starts from a known-good baseline and patches what they want.
   "Validate" runs the same zod parse the server uses, surfacing field-
   path errors before save. */

export function ConfigEditor({
  initialSnapshotJson,
  baseVersionNumber,
}: {
  initialSnapshotJson: string;
  baseVersionNumber: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [snapshotJson, setSnapshotJson] = useState(initialSnapshotJson);
  const [note, setNote] = useState("");
  const [activate, setActivate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);

  function validateClientSide(): boolean {
    setError(null);
    setDetails([]);
    try {
      const parsed = JSON.parse(snapshotJson);
      const result = ConfigSnapshotSchema.safeParse(parsed);
      if (!result.success) {
        setError("Snapshot failed schema validation");
        setDetails(
          result.error.issues.map(
            (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
          )
        );
        return false;
      }
      return true;
    } catch (err) {
      setError("Snapshot is not valid JSON");
      setDetails([err instanceof Error ? err.message : String(err)]);
      return false;
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateClientSide()) return;

    startTransition(async () => {
      const result = await saveConfigVersion({
        snapshotJson,
        note,
        activate,
      });
      // On success the action redirects (control-flow exception). We
      // only land here on validation failure or DB error.
      if (result && !result.ok) {
        setError(result.error);
        setDetails(result.details ?? []);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-border-subtle bg-bg-elevated px-4 py-3 text-sm text-fg-muted">
        Pre-filled from the currently active snapshot ({" "}
        <strong className="text-fg-default">v{baseVersionNumber}</strong>{" "}
        ). Edit any field — weights, caps, disqualifier rules, industry
        profile overrides, prompt strings. Save creates a new immutable
        version; the previous one stays in history for rollback.
      </div>

      <Field
        label="Note"
        hint="Short changelog message. Shows up in the version history. Optional but recommended."
      >
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={`e.g. "Bumped SaaS niche-match cap to 45"`}
        />
      </Field>

      <Field
        label="Snapshot JSON"
        hint="The full ConfigSnapshot. Schema is validated on save — typos and missing fields are caught before the new version is written."
      >
        <Textarea
          value={snapshotJson}
          onChange={(e) => setSnapshotJson(e.target.value)}
          rows={28}
          spellCheck={false}
          className="font-mono text-xs"
        />
      </Field>

      <Field label="Activation">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-fg-default">
          <input
            type="checkbox"
            checked={activate}
            onChange={(e) => setActivate(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-accent"
          />
          Activate this version immediately on save
        </label>
        <p className="mt-1 text-xs text-fg-muted">
          When checked, the ActiveConfig pointer flips to the new version
          and future scoring runs use it. Uncheck to save as a staged
          version you can activate later from the history list.
        </p>
      </Field>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-soft p-4 text-sm text-danger"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{error}</div>
              {details.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                  {details.map((d, i) => (
                    <li key={i} className="font-mono">
                      {d}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/config")}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={validateClientSide}
          disabled={pending}
        >
          Validate
        </Button>
        <Button type="submit" disabled={pending} size="lg">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : activate ? (
            "Save & Activate"
          ) : (
            "Save Version"
          )}
        </Button>
      </div>
    </form>
  );
}
