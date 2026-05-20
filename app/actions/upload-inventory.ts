"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { parseInventoryCsv } from "@/lib/csv/parser";
import { CsvParseError } from "@/lib/csv/types";
import { log } from "@/lib/log";

// Note: `maxDuration` is configured on app/campaigns/[id]/page.tsx (the page
// that invokes this action). Route-segment config can't be exported from a
// `"use server"` file — Next.js requires all exports to be async functions.

export type UploadInventoryResult =
  | {
      ok: true;
      rowCount: number;
      skippedHeaderRows: number;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
      details?: { headers?: string[]; missing?: string[] };
    };

// Server action: receives a CSV File via FormData, parses it, and persists
// the domains + InventoryUpload metadata. Replaces any prior upload for
// this campaign (an InventoryUpload row is unique per campaignId).
export async function uploadInventory(
  campaignId: string,
  formData: FormData
): Promise<UploadInventoryResult> {
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return { ok: false, error: "No file uploaded" };
  }

  const filename = "name" in file ? (file as File).name : "inventory.csv";
  const text = await (file as File).text();

  if (!text.trim()) {
    return { ok: false, error: "Uploaded file is empty" };
  }

  let parsed;
  try {
    parsed = parseInventoryCsv(text);
  } catch (err) {
    if (err instanceof CsvParseError) {
      log.warn(
        { campaignId, err: err.message, details: err.details },
        "CSV parse failed"
      );
      return { ok: false, error: err.message, details: err.details };
    }
    log.error({ campaignId, err }, "Unexpected error parsing CSV");
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown parse error",
    };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // Remove any prior upload for this campaign — cascade deletes Domain
        // rows and (via separate cascade rules) Score / Selection rows that
        // referenced those domains.
        const prior = await tx.inventoryUpload.findUnique({
          where: { campaignId },
        });
        if (prior) {
          await tx.inventoryUpload.delete({ where: { campaignId } });
          await tx.score.deleteMany({ where: { campaignId } });
          await tx.selection.deleteMany({ where: { campaignId } });
        }

        const upload = await tx.inventoryUpload.create({
          data: {
            campaignId,
            originalFilename: filename,
            rowCount: parsed.rowCount,
            skippedHeaderRows: parsed.skippedHeaderRows,
            rawCsv: text,
          },
        });

        // Bulk insert domains in chunks to keep query size reasonable.
        const CHUNK = 500;
        for (let i = 0; i < parsed.rows.length; i += CHUNK) {
          const chunk = parsed.rows.slice(i, i + CHUNK);
          await tx.domain.createMany({
            data: chunk.map((r) => ({
              inventoryUploadId: upload.id,
              rowIndex: r.rowIndex,
              domain: r.domain,
              domainRating: r.domainRating,
              traffic: r.traffic,
              geo: r.geo,
              gpPrice: r.gpPrice,
              liPrice: r.liPrice,
              isFree: r.isFree,
              tat: r.tat,
              linkType: r.linkType,
              ranking: r.ranking,
              contactEmail: r.contactEmail,
              nicheRaw: r.nicheRaw,
              mainNiche: r.mainNiche,
              complementary: r.complementary,
              indirect: r.indirect,
              redFlags: r.redFlags,
              rawData: r.rawData,
            })),
          });
        }

        // Advance campaign status to indicate inventory is loaded but
        // scoring hasn't run yet. Clear configVersionId so the UI knows
        // the prior shortlist is stale.
        await tx.campaign.update({
          where: { id: campaignId },
          data: {
            status: "INVENTORY_LOADED",
            configVersionId: null,
            scoredAt: null,
          },
        });
      },
      {
        // Bulk insert of 2k+ rows can run past Prisma's 5s default.
        maxWait: 10_000,
        timeout: 60_000,
      }
    );
  } catch (err) {
    log.error({ campaignId, err }, "Failed to persist inventory upload");
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Database write failed",
    };
  }

  log.info(
    {
      campaignId,
      filename,
      rowCount: parsed.rowCount,
      skippedHeaderRows: parsed.skippedHeaderRows,
    },
    "Inventory uploaded"
  );

  revalidatePath(`/campaigns/${campaignId}`);

  return {
    ok: true,
    rowCount: parsed.rowCount,
    skippedHeaderRows: parsed.skippedHeaderRows,
    warnings: parsed.warnings,
  };
}
