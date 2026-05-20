"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { ConfigSnapshotSchema } from "@/lib/config/types";
import { log } from "@/lib/log";

export type SaveConfigVersionError = {
  ok: false;
  error: string;
  details?: string[];
};

// Saves a new ConfigVersion row, optionally flips ActiveConfig to point
// at it. On success, redirects to /admin/config (which throws a control-
// flow exception). On failure, returns a typed error object the form can
// render.
export async function saveConfigVersion(input: {
  snapshotJson: string;
  note: string;
  activate: boolean;
}): Promise<SaveConfigVersionError | void> {
  // ---------- Parse + validate ----------
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.snapshotJson);
  } catch (err) {
    return {
      ok: false,
      error: "Snapshot is not valid JSON",
      details: [err instanceof Error ? err.message : String(err)],
    };
  }

  const parsed = ConfigSnapshotSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Snapshot failed schema validation",
      details: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`
      ),
    };
  }

  // ---------- Insert + (optional) activate ----------
  let newVersionNumber: number;
  try {
    const maxVersion = await prisma.configVersion.aggregate({
      _max: { versionNumber: true },
    });
    newVersionNumber = (maxVersion._max.versionNumber ?? 0) + 1;

    const created = await prisma.configVersion.create({
      data: {
        versionNumber: newVersionNumber,
        snapshot: parsed.data,
        note: input.note.trim() || null,
      },
    });

    if (input.activate) {
      await prisma.activeConfig.update({
        where: { id: "singleton" },
        data: { configVersionId: created.id, activatedAt: new Date() },
      });
    }

    log.info(
      {
        versionId: created.id,
        versionNumber: newVersionNumber,
        activated: input.activate,
      },
      "ConfigVersion saved"
    );
  } catch (err) {
    log.error({ err }, "Failed to save ConfigVersion");
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Database write failed",
    };
  }

  // Successful path — outside try/catch so the redirect's control-flow
  // exception isn't swallowed.
  revalidatePath("/admin/config");
  revalidatePath("/"); // home page shows config version on campaign rows
  redirect("/admin/config");
}
