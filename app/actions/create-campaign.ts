"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import {
  BriefSchema,
  parseDomainList,
  parseNicheString,
  type AnchorStrategy,
  type LinkTypeKey,
} from "@/lib/brief/schema";
import { log } from "@/lib/log";

export interface CreateCampaignInput {
  clientName: string;
  nichesRaw: string;          // comma-separated; parsed server-side
  targetPages: { url: string; keyword: string }[];
  budgetPerLink: number;
  geoFocus: string;
  followPreference: "DOFOLLOW" | "NOFOLLOW" | "EITHER";
  minDR: number;
  minTraffic: number;
  linkCountGoal: number;
  industryProfile: "SAAS" | "ECOMMERCE" | "FINTECH" | "LOCAL_SERVICES";
  // New disqualifier + informational inputs
  excludedNichesRaw: string;       // comma-separated
  competitorBlocklistRaw: string;  // one per line or comma-separated
  linkTypes: LinkTypeKey[];
  anchorStrategy: AnchorStrategy;
  teamNotes: string;
}

export type CreateCampaignResult =
  | { ok: true; campaignId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createCampaign(
  input: CreateCampaignInput
): Promise<CreateCampaignResult> {
  // Validate with the canonical zod schema. Parse raw strings into arrays first.
  const briefCandidate = {
    clientName: input.clientName.trim(),
    niches: parseNicheString(input.nichesRaw),
    targetPages: input.targetPages.filter((p) => p.url && p.keyword),
    budgetPerLink: Number(input.budgetPerLink),
    geoFocus: (input.geoFocus || "global").trim(),
    followPreference: input.followPreference,
    minDR: Number(input.minDR),
    minTraffic: Number(input.minTraffic),
    linkCountGoal: Number(input.linkCountGoal),
    industryProfile: input.industryProfile,
    excludedNiches: parseNicheString(input.excludedNichesRaw),
    competitorBlocklist: parseDomainList(input.competitorBlocklistRaw),
    linkTypes: input.linkTypes,
    anchorStrategy: input.anchorStrategy,
    teamNotes: input.teamNotes.trim(),
  };

  const parsed = BriefSchema.safeParse(briefCandidate);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      error: "Brief validation failed",
      fieldErrors,
    };
  }

  const brief = parsed.data;

  try {
    const campaign = await prisma.campaign.create({
      data: {
        name: brief.clientName,
        brief: brief,
        industryProfile: brief.industryProfile,
        status: "DRAFT",
      },
    });
    log.info(
      { campaignId: campaign.id, clientName: brief.clientName },
      "Campaign created"
    );
    revalidatePath("/");
    redirect(`/campaigns/${campaign.id}`);
  } catch (err) {
    // `redirect` throws a control-flow error; rethrow it so Next handles
    // the navigation rather than catching it as a failure.
    if (err && typeof err === "object" && "digest" in err) {
      throw err;
    }
    log.error({ err }, "Failed to create campaign");
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
