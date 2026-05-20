"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power } from "lucide-react";

import { activateConfigVersion } from "@/app/actions/activate-config-version";
import { Button } from "@/components/ui/button";

/* Two-step inline confirmation for switching the active config. Mirrors
   the delete-campaign pattern — no modal, deliberate second click. */

export function ActivateConfigButton({
  versionId,
  versionNumber,
}: {
  versionId: number;
  versionNumber: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleActivate() {
    setError(null);
    startTransition(async () => {
      const result = await activateConfigVersion(versionId);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.refresh();
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleActivate}
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Activating…
            </>
          ) : (
            `Yes, activate v${versionNumber}`
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
          <p role="alert" className="basis-full text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => setConfirming(true)}
    >
      <Power className="h-3.5 w-3.5" aria-hidden />
      Activate
    </Button>
  );
}
