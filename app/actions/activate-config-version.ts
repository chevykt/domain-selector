"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { log } from "@/lib/log";

export type ActivateConfigVersionResult =
  | { ok: true; versionNumber: number }
  | { ok: false; error: string };

// Flips the ActiveConfig singleton pointer to a different ConfigVersion.
// Rollback is exactly this — pointing at an older version. Existing
// campaigns are unaffected because each Campaign.configVersionId is a
// hard pointer to the version it was scored against.
export async function activateConfigVersion(
  versionId: number
): Promise<ActivateConfigVersionResult> {
  try {
    const version = await prisma.configVersion.findUnique({
      where: { id: versionId },
      select: { id: true, versionNumber: true },
    });
    if (!version) {
      return { ok: false, error: `ConfigVersion ${versionId} not found` };
    }

    await prisma.activeConfig.update({
      where: { id: "singleton" },
      data: { configVersionId: version.id, activatedAt: new Date() },
    });

    log.info(
      { versionId: version.id, versionNumber: version.versionNumber },
      "Active config switched"
    );

    revalidatePath("/admin/config");
    return { ok: true, versionNumber: version.versionNumber };
  } catch (err) {
    log.error({ versionId, err }, "Failed to activate ConfigVersion");
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Activation failed",
    };
  }
}
