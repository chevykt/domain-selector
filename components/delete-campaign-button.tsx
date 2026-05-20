"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { deleteCampaign } from "@/app/actions/delete-campaign";
import { Button } from "@/components/ui/button";

/* Two-step inline confirmation: first click reveals a "Yes, delete" +
   "Cancel" pair. No modal — avoids the accidental-click-then-confirm
   muscle memory people develop with dialogs. */

export function DeleteCampaignButton({
  campaignId,
  campaignName,
}: {
  campaignId: string;
  campaignName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCampaign(campaignId);
      // On success the action throws redirect (framework control flow),
      // which we never reach here. We only land in this branch on error.
      if (result && !result.ok) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-fg-default">
          Permanently delete{" "}
          <strong className="text-fg-strong">{campaignName}</strong> and all
          its scoring data?
        </span>
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={handleDelete}
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Deleting…
            </>
          ) : (
            "Yes, delete"
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Cancel
        </Button>
        {error && (
          <p role="alert" className="basis-full text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="danger"
      size="sm"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="h-4 w-4" aria-hidden />
      Delete campaign
    </Button>
  );
}
