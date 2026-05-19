"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { loadActiveConfig } from "@/lib/config/loader";
import { BriefSchema } from "@/lib/brief/schema";
import { scoreDomain } from "@/lib/scoring/engine";
import type { ScoreInput } from "@/lib/scoring/types";
import { log } from "@/lib/log";

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
export async function scoreCampaign(
  campaignId: string
): Promise<ScoreCampaignResult> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      inventoryUpload: { include: { domains: true } },
    },
  });

  if (!campaign) return { ok: false, error: "Campaign not found" };
  if (!campaign.inventoryUpload) {
    return { ok: false, error: "No inventory uploaded for this campaign" };
  }

  const briefParse = BriefSchema.safeParse(campaign.brief);
  if (!briefParse.success) {
    return {
      ok: false,
      error: `Stored brief is invalid: ${briefParse.error.message}`,
    };
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
      // recomputed numbers against a new config version. If a previously
      // selected domain is now disqualified, it simply won't render in
      // the shortlist; the user can clear it via "Deselect all".
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
    {
      // Score writes for ~2k domains can run past Prisma's 5s default.
      maxWait: 10_000,
      timeout: 60_000,
    }
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
}
