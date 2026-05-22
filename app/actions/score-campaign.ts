"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { loadActiveConfig } from "@/lib/config/loader";
import { BriefSchema } from "@/lib/brief/schema";
import { scoreDomain } from "@/lib/scoring/engine";
import { STALE_LOCK_MS } from "@/lib/scoring/constants";
import type { ScoreInput } from "@/lib/scoring/types";
import { log } from "@/lib/log";

// Note: `maxDuration` is configured on app/campaigns/[id]/page.tsx (the page
// that invokes this action). Route-segment config can't be exported from a
// `"use server"` file — Next.js requires all exports to be async functions.

export type ScoreCampaignResult = { ok: true } | { ok: false; error: string };

// Kicks off a scoring run. This action does the bare minimum synchronously —
// claim the lock, then return — and hands the heavy work to `after()` so the
// scoring runs AFTER the response is sent.
//
// Why: Next.js freezes the App Router while a Server Action is in flight. If we
// awaited the full run here (seconds), every router.refresh() — including the
// "in progress" card's polling — would queue behind it, and the UI couldn't
// update until a full page reload. Returning immediately keeps the router free;
// the polling card then flips to the shortlist on its own when scoring lands.
//
// Concurrency model:
//   - First caller flips status SCORED|INVENTORY_LOADED|FINALIZED (or a stale
//     SCORING_IN_PROGRESS) → SCORING_IN_PROGRESS via an atomic updateMany.
//   - Concurrent callers see count=0 and exit with a friendly error.
//   - The background run (runScoring) owns the lock: SCORED on success, or
//     released to INVENTORY_LOADED on failure. A dead run (e.g. a function
//     timeout) is recovered by the stale-lock takeover in the claim.
export async function scoreCampaign(
  campaignId: string
): Promise<ScoreCampaignResult> {
  // ---------- Claim the lock (with stale-lock takeover) ----------
  // Matches either an idle campaign OR a stale in-progress lock left by a run
  // that died before releasing it. A live run can't outlast the 60s function
  // cap, so SCORING_IN_PROGRESS older than STALE_LOCK_MS is provably dead. The
  // updateMany is atomic, so concurrent takeovers can't race.
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
  const claim = await prisma.campaign.updateMany({
    where: {
      id: campaignId,
      OR: [
        { status: { in: ["INVENTORY_LOADED", "SCORED", "FINALIZED"] } },
        { status: "SCORING_IN_PROGRESS", updatedAt: { lt: staleBefore } },
      ],
    },
    data: { status: "SCORING_IN_PROGRESS" },
  });
  if (claim.count === 0) {
    // Campaign doesn't exist, has no inventory yet, or a fresh run is active.
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
        error:
          "Scoring is already in progress for this campaign. It updates automatically when finished.",
      };
    }
    return { ok: false, error: `Cannot score from status ${existing.status}.` };
  }

  // ---------- Hand the heavy work to after() ----------
  // Runs after this response is flushed; Vercel keeps the invocation alive
  // (waitUntil) up to the route's maxDuration. runScoring owns the lock from
  // here and always resolves it, so the campaign can't be left stuck.
  after(() => runScoring(campaignId));

  // Flip the UI to the polling "in progress" card and return immediately.
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: true };
}

// The deterministic scoring run. Not exported, so this "use server" file still
// only exports async actions. Persists Score rows and stamps the campaign with
// the config version it was scored against. Selections are preserved across
// re-scores — they represent user intent, not derived data.
async function runScoring(campaignId: string): Promise<void> {
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
          disqualifierReasons: result.reasons.map(
            (r) => `${r.code}: ${r.message}`
          ),
          reasoning: result.reasons.map((r) => r.message).join("; "),
        });
      } else {
        qualified++;
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
        // Replace Score rows only. Selections are preserved across re-scores.
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
  } catch (err) {
    // Release the lock so the campaign isn't left stuck. (The stale-lock
    // takeover in scoreCampaign is the backstop if even this release fails.)
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
  }
}
