"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { loadActiveConfig } from "@/lib/config/loader";
import { BriefSchema } from "@/lib/brief/schema";
import { scoreDomain } from "@/lib/scoring/engine";
import type { ScoreInput } from "@/lib/scoring/types";
import { log } from "@/lib/log";

// Vercel function duration cap. Hobby allows up to 60s; this gives ~5x
// headroom over the worst-case 2,300-row scoring run (~10s end-to-end).
export const maxDuration = 60;

export type ScoreCampaignResult =
  | {
      ok: true;
      totalDomains: number;
      qualified: number;
      disqualified: number;
      maxScore: number;
      configVersionNumber: number;
    }
  | { ok: false; error: string };

// Runs the deterministic scoring engine over every domain in the
// campaign's inventory upload, persists Score rows, and stamps the
// campaign with the config version it was scored against (so the same
// shortlist can be reproduced later).
//
// Concurrency model:
//   - First action that arrives flips status SCORED|INVENTORY_LOADED|FINALIZED
//     → SCORING_IN_PROGRESS via a conditional updateMany (atomic claim).
//   - Subsequent concurrent invocations see count=0 from the claim and exit
//     with a friendly error, so the user can't double-score by refreshing.
//   - On any failure, the catch releases the lock back to INVENTORY_LOADED.
//   - On success, the final tx.campaign.update sets status to SCORED.
export async function scoreCampaign(
  campaignId: string
): Promise<ScoreCampaignResult> {
  // ---------- 1. Claim the lock ----------
  const claim = await prisma.campaign.updateMany({
    where: {
      id: campaignId,
      status: { in: ["INVENTORY_LOADED", "SCORED", "FINALIZED"] },
    },
    data: { status: "SCORING_IN_PROGRESS" },
  });
  if (claim.count === 0) {
    // Either the campaign doesn't exist, has no inventory yet, or another
    // scoring run is already in progress.
    const existing = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    if (!existing) return { ok: false, error: "Campaign not found" };
    if (existing.status === "DRAFT") {
      return { ok: false, error: "Upload inventory before scoring." };
    }
    if (existing.status === "SCORING_IN_PROGRESS") {
      return {
        ok: false,
        error: "Scoring is already in progress for this campaign. Refresh in a few seconds.",
      };
    }
    return { ok: false, error: `Cannot score from status ${existing.status}.` };
  }

  // Revalidate immediately so the UI flips to the "in progress" card.
  revalidatePath(`/campaigns/${campaignId}`);

  // ---------- 2. Run scoring (with lock release on failure) ----------
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        inventoryUpload: { include: { domains: true } },
      },
    });
    if (!campaign || !campaign.inventoryUpload) {
      throw new Error("Inventory disappeared between claim and read");
    }

    const briefParse = BriefSchema.safeParse(campaign.brief);
    if (!briefParse.success) {
      throw new Error(`Stored brief is invalid: ${briefParse.error.message}`);
    }
    const brief = briefParse.data;

    const { snapshot: config, versionId, versionNumber } =
      await loadActiveConfig();

    const domains = campaign.inventoryUpload.domains;
    log.info(
      { campaignId, domains: domains.length, configVersion: versionNumber },
      "Starting scoring run"
    );

    const scoreRows: {
      campaignId: string;
      domainId: string;
      total: number;
      maxPossible: number;
      breakdown: object;
      disqualified: boolean;
      disqualifierReasons: string[];
      reasoning: string;
    }[] = [];

    let qualified = 0;
    let disqualified = 0;
    let maxScoreSeen = 0;

    for (const d of domains) {
      const input: ScoreInput = {
        brief,
        domain: {
          rowIndex: d.rowIndex,
          domain: d.domain,
          domainRating: d.domainRating,
          traffic: d.traffic,
          geo: d.geo,
          gpPrice: d.gpPrice,
          liPrice: d.liPrice,
          isFree: d.isFree,
          tat: d.tat,
          linkType: d.linkType,
          ranking: d.ranking,
          contactEmail: d.contactEmail,
          nicheRaw: d.nicheRaw,
          mainNiche: d.mainNiche,
          complementary: d.complementary,
          indirect: d.indirect,
          redFlags: d.redFlags,
        },
      };

      const result = scoreDomain(input, config);

      if (result.disqualified) {
        disqualified++;
        scoreRows.push({
          campaignId,
          domainId: d.id,
          total: 0,
          maxPossible: 0,
          breakdown: {},
          disqualified: true,
          disqualifierReasons: result.reasons.map((r) => `${r.code}: ${r.message}`),
          reasoning: result.reasons.map((r) => r.message).join("; "),
        });
      } else {
        qualified++;
        maxScoreSeen = Math.max(maxScoreSeen, result.maxPossible);
        scoreRows.push({
          campaignId,
          domainId: d.id,
          total: result.total,
          maxPossible: result.maxPossible,
          breakdown: result.breakdown,
          disqualified: false,
          disqualifierReasons: [],
          reasoning: result.reasoning,
        });
      }
    }

    await prisma.$transaction(
      async (tx) => {
        // Replace Score rows only. Selections are intentionally preserved
        // across re-scores — they represent user intent ("I want this
        // domain in the campaign") and shouldn't vanish just because we
        // recomputed numbers against a new config version.
        await tx.score.deleteMany({ where: { campaignId } });

        const CHUNK = 500;
        for (let i = 0; i < scoreRows.length; i += CHUNK) {
          await tx.score.createMany({
            data: scoreRows.slice(i, i + CHUNK),
          });
        }

        await tx.campaign.update({
          where: { id: campaignId },
          data: {
            status: "SCORED",
            configVersionId: versionId,
            scoredAt: new Date(),
          },
        });
      },
      { maxWait: 10_000, timeout: 60_000 }
    );

    log.info(
      { campaignId, qualified, disqualified, configVersion: versionNumber },
      "Scoring complete"
    );

    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath(`/campaigns/${campaignId}/excluded`);

    return {
      ok: true,
      totalDomains: domains.length,
      qualified,
      disqualified,
      maxScore: maxScoreSeen,
      configVersionNumber: versionNumber,
    };
  } catch (err) {
    // ---------- 3. Release the lock on any failure ----------
    log.error({ campaignId, err }, "Scoring failed — releasing lock");
    await prisma.campaign
      .updateMany({
        where: { id: campaignId, status: "SCORING_IN_PROGRESS" },
        data: { status: "INVENTORY_LOADED" },
      })
      .catch((releaseErr) => {
        log.error(
          { campaignId, releaseErr },
          "Failed to release SCORING_IN_PROGRESS lock"
        );
      });
    revalidatePath(`/campaigns/${campaignId}`);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Scoring failed",
    };
  }
}
