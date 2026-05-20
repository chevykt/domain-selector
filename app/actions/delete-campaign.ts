"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

export type DeleteCampaignResult =
  | { ok: true }
  | { ok: false; error: string };

// Hard-delete a campaign and everything it owns. Cascade rules in
// prisma/schema.prisma propagate the delete to:
//   - InventoryUpload (1:1 with Campaign)
//   - Domain (cascade from InventoryUpload)
//   - Score (cascade from Domain AND from Campaign — belt and braces)
//   - Selection (cascade from both)
// ConfigVersion is referenced by Campaign.configVersionId but is NOT
// cascade-deleted — it's shared metadata and stays available for other
// campaigns / rollback.
export async function deleteCampaign(
  campaignId: string
): Promise<DeleteCampaignResult> {
  try {
    await prisma.campaign.delete({ where: { id: campaignId } });
    log.info({ campaignId }, "Campaign deleted");
    revalidatePath("/");
  } catch (err) {
    log.error({ campaignId, err }, "Failed to delete campaign");
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Delete failed",
    };
  }
  // redirect throws a framework-handled control-flow exception; calling
  // it outside the try/catch keeps the throw from being swallowed.
  redirect("/");
}
