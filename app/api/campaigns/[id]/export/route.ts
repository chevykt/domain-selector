import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { BriefSchema } from "@/lib/brief/schema";
import { buildCampaignWorkbook } from "@/lib/xlsx/export";
import { log } from "@/lib/log";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/campaigns/[id]/export">
) {
  const { id } = await ctx.params;

  // Optional client-supplied filter — restricts the export to the
  // currently visible selections (Shortlist sends visible+selected IDs
  // so dedupe-hidden rows don't sneak into the workbook).
  const idsParam = req.nextUrl.searchParams.get("domainIds");
  const filterDomainIds = idsParam
    ? idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      selections: {
        where: {
          included: true,
          ...(filterDomainIds ? { domainId: { in: filterDomainIds } } : {}),
        },
        include: {
          domain: true,
        },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const briefParse = BriefSchema.safeParse(campaign.brief);
  if (!briefParse.success) {
    log.error(
      { campaignId: id, issues: briefParse.error.issues },
      "Stored brief invalid for export"
    );
    return NextResponse.json(
      { error: "Stored brief is invalid; cannot export" },
      { status: 500 }
    );
  }

  // Pull score totals for each included domain so the export can include them.
  const includedDomainIds = campaign.selections.map((s) => s.domainId);
  const scores = await prisma.score.findMany({
    where: { campaignId: id, domainId: { in: includedDomainIds } },
    select: { domainId: true, total: true },
  });
  const scoreByDomain = new Map(scores.map((s) => [s.domainId, s.total]));

  const selected = campaign.selections.map((sel) => {
    const d = sel.domain;
    return {
      domain: d.domain,
      dr: d.domainRating,
      traffic: d.traffic,
      geo: d.geo,
      gpPrice: d.gpPrice,
      liPrice: d.liPrice,
      isFree: d.isFree,
      tat: d.tat,
      linkType: d.linkType,
      contactEmail: d.contactEmail,
      score: scoreByDomain.get(d.id) ?? 0,
    };
  });

  // Order selections by score desc so the CM tab reads top-down by quality.
  selected.sort((a, b) => b.score - a.score);

  let buffer: Buffer;
  try {
    buffer = await buildCampaignWorkbook({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        createdAt: campaign.createdAt,
        status: campaign.status,
        industryProfile: campaign.industryProfile,
      },
      brief: briefParse.data,
      selected,
    });
  } catch (err) {
    log.error({ campaignId: id, err }, "Failed to build export workbook");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }

  // Mark the campaign as FINALIZED on first successful export. We don't
  // block subsequent re-exports; status just stays FINALIZED.
  if (campaign.status === "SCORED") {
    await prisma.campaign.update({
      where: { id },
      data: { status: "FINALIZED" },
    });
  }

  const safeName = campaign.name
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const filename = `${safeName || "campaign"}_export.xlsx`;

  log.info(
    { campaignId: id, selectedCount: selected.length, filename },
    "Export generated"
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
