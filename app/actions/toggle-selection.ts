"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

export interface ToggleSelectionResult {
  ok: boolean;
  included: boolean;
  error?: string;
}

// Toggles or sets the inclusion state of a single (campaign, domain) pair.
// Idempotent — upserts the Selection row.
export async function toggleSelection(
  campaignId: string,
  domainId: string,
  included: boolean
): Promise<ToggleSelectionResult> {
  try {
    await prisma.selection.upsert({
      where: {
        campaignId_domainId: { campaignId, domainId },
      },
      update: { included },
      create: { campaignId, domainId, included },
    });
    revalidatePath(`/campaigns/${campaignId}`);
    return { ok: true, included };
  } catch (err) {
    log.error(
      { campaignId, domainId, included, err },
      "Failed to update selection"
    );
    return {
      ok: false,
      included,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Reset all selections for a campaign back to false. Used by the
// "deselect all" UI control.
export async function clearAllSelections(
  campaignId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.selection.updateMany({
      where: { campaignId },
      data: { included: false },
    });
    revalidatePath(`/campaigns/${campaignId}`);
    return { ok: true };
  } catch (err) {
    log.error({ campaignId, err }, "Failed to clear selections");
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
