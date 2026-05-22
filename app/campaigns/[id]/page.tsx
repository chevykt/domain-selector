import { notFound } from "next/navigation";

import { BackLink } from "@/components/ui/back-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DeleteCampaignButton } from "@/components/delete-campaign-button";
import { InventoryUpload } from "@/components/inventory-upload";
import { ScoreButton } from "@/components/score-button";
import { ScoringInProgress } from "@/components/scoring-in-progress";
import { Shortlist, type ShortlistRow } from "@/components/shortlist";
import { ANCHOR_STRATEGY_OPTIONS } from "@/lib/brief/schema";
import { isScoringLockStale } from "@/lib/scoring/constants";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/utils";

// Cap how many scored rows we ship to the client. Limit selector tops at 100,
// so 200 gives headroom and includes any selected-but-out-of-view rows.
const TOP_N_SERVER = 200;

// Vercel function duration cap. Covers the Server Actions that fire from
// this page: uploadInventory (CSV parse + bulk insert) and scoreCampaign
// (scoring + Score writes). Hobby Plan allows up to 60s.
export const maxDuration = 60;

// Always re-fetch on revalidate / router.refresh. Without this Next can
// serve a cached render where status hasn't flipped yet (e.g., after
// scoring or after the export auto-promotes status → FINALIZED).
export const dynamic = "force-dynamic";

const STATUS: Record<
  string,
  { label: string; tone: "neutral" | "accent" | "success" | "warn" }
> = {
  DRAFT: { label: "Brief saved", tone: "neutral" },
  INVENTORY_LOADED: { label: "Inventory loaded", tone: "accent" },
  SCORING_IN_PROGRESS: { label: "Scoring…", tone: "accent" },
  SCORED: { label: "Shortlist ready", tone: "success" },
  FINALIZED: { label: "Exported", tone: "warn" },
};

const ANCHOR_LABEL: Record<string, string> = Object.fromEntries(
  ANCHOR_STRATEGY_OPTIONS.map((o) => [o.value, o.label])
);

const LINK_TYPE_LABEL: Record<string, string> = {
  GP: "Guest Post",
  LI: "Niche Edit",
  LE: "Link Exchange",
};

export default async function CampaignPage(
  props: PageProps<"/campaigns/[id]">
) {
  const { id } = await props.params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      inventoryUpload: true,
      configVersion: true,
    },
  });
  if (!campaign) notFound();

  const brief = campaign.brief as {
    clientName: string;
    niches: string[];
    targetPages: { url: string; keyword: string }[];
    budgetPerLink: number;
    geoFocus: string;
    followPreference: string;
    minDR: number;
    minTraffic: number;
    linkCountGoal: number;
    industryProfile: string;
    excludedNiches?: string[];
    competitorBlocklist?: string[];
    linkTypes?: string[];
    anchorStrategy?: string;
    teamNotes?: string;
  };

  const [qualifiedCount, disqualifiedCount] = await Promise.all([
    prisma.score.count({ where: { campaignId: id, disqualified: false } }),
    prisma.score.count({ where: { campaignId: id, disqualified: true } }),
  ]);

  const scored = await prisma.score.findMany({
    where: { campaignId: id, disqualified: false },
    orderBy: [{ total: "desc" }, { computedAt: "asc" }],
    take: TOP_N_SERVER,
    include: {
      domain: {
        include: {
          selections: { where: { campaignId: id } },
        },
      },
    },
  });

  const shortlistRows: ShortlistRow[] = scored.map((s) => ({
    domainId: s.domainId,
    domain: s.domain.domain,
    total: s.total,
    maxPossible: s.maxPossible,
    reasoning: s.reasoning,
    breakdown: s.breakdown as ShortlistRow["breakdown"],
    domainRating: s.domain.domainRating,
    traffic: s.domain.traffic,
    geo: s.domain.geo,
    gpPrice: s.domain.gpPrice,
    liPrice: s.domain.liPrice,
    isFree: s.domain.isFree,
    tat: s.domain.tat,
    linkType: s.domain.linkType,
    contactEmail: s.domain.contactEmail,
    redFlags: s.domain.redFlags,
    initiallyIncluded: s.domain.selections[0]?.included ?? false,
  }));

  const hasInventory = !!campaign.inventoryUpload;
  // A SCORING_IN_PROGRESS lock older than STALE_LOCK_MS is from a run that died
  // without releasing it (see score-campaign.ts). Treat it as recoverable so the
  // Score button reappears — re-running scoring atomically takes over the lock.
  const isStaleLock = isScoringLockStale(campaign.status, campaign.updatedAt);
  const isScoring =
    campaign.status === "SCORING_IN_PROGRESS" && !isStaleLock;
  const isScored =
    campaign.status === "SCORED" || campaign.status === "FINALIZED";

  const status = isStaleLock
    ? { label: "Needs scoring", tone: "neutral" as const }
    : STATUS[campaign.status] ?? {
        label: campaign.status,
        tone: "neutral" as const,
      };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <nav className="mb-4">
        <BackLink href="/">Back to campaigns</BackLink>
      </nav>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 text-xs uppercase tracking-wider text-fg-subtle">
            {campaign.industryProfile.replace("_", " ")} profile · created{" "}
            {campaign.createdAt.toLocaleString()}
            {campaign.configVersion && (
              <> · scored against config v{campaign.configVersion.versionNumber}</>
            )}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-fg-strong">
            {campaign.name}
          </h1>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </header>

      {/* ---------- Brief summary ---------- */}
      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Brief" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              <SummaryRow label="Niches">{brief.niches.join(", ")}</SummaryRow>
              <SummaryRow label="Budget / link">${brief.budgetPerLink}</SummaryRow>
              <SummaryRow label="Link goal">{brief.linkCountGoal}</SummaryRow>
              <SummaryRow label="Geo">{brief.geoFocus}</SummaryRow>
              <SummaryRow label="Follow">{brief.followPreference}</SummaryRow>
              <SummaryRow label="Min DR">{brief.minDR}</SummaryRow>
              <SummaryRow label="Min traffic">
                {brief.minTraffic.toLocaleString()}
              </SummaryRow>
              <SummaryRow label="Anchor strategy">
                {ANCHOR_LABEL[brief.anchorStrategy ?? ""] ?? "—"}
              </SummaryRow>
              {brief.linkTypes && brief.linkTypes.length > 0 && (
                <SummaryRow label="Link types">
                  {brief.linkTypes.map((t) => LINK_TYPE_LABEL[t] ?? t).join(", ")}
                </SummaryRow>
              )}
              {brief.excludedNiches && brief.excludedNiches.length > 0 && (
                <SummaryRow label="Excluded">
                  {brief.excludedNiches.join(", ")}
                </SummaryRow>
              )}
              {brief.competitorBlocklist &&
                brief.competitorBlocklist.length > 0 && (
                  <SummaryRow label="Blocked sites">
                    {brief.competitorBlocklist.join(", ")}
                  </SummaryRow>
                )}
            </dl>
            {brief.teamNotes && (
              <div className="mt-4 rounded-md border border-border-subtle bg-bg-input/40 p-3 text-xs text-fg-muted">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-fg-subtle">
                  Notes
                </div>
                <div className="whitespace-pre-wrap text-fg-default">
                  {brief.teamNotes}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={`Target pages (${brief.targetPages.length})`}
          />
          <CardBody>
            <ul className="space-y-3 text-sm">
              {brief.targetPages.map((p, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border-subtle bg-bg-input/40 p-3"
                >
                  <div className="break-all font-medium text-fg-default">
                    {p.url}
                  </div>
                  <div className="mt-1 text-xs text-fg-muted">
                    keyword:{" "}
                    <span className="font-mono text-accent">{p.keyword}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>

      {/* ---------- Inventory step ---------- */}
      <section className="mb-6">
        <InventoryUpload
          campaignId={id}
          existingFilename={campaign.inventoryUpload?.originalFilename}
          existingRowCount={campaign.inventoryUpload?.rowCount}
          existingSkippedRows={campaign.inventoryUpload?.skippedHeaderRows}
        />
      </section>

      {/* ---------- Scoring-in-progress card (polls every 3s) ---------- */}
      {isScoring && campaign.inventoryUpload && (
        <section className="mb-6">
          <ScoringInProgress
            startedAt={campaign.updatedAt}
            inventoryCount={campaign.inventoryUpload.rowCount}
          />
        </section>
      )}

      {/* ---------- Score step (only when idle, not in-progress) ---------- */}
      {hasInventory && !isScored && !isScoring && (
        <section className="mb-6">
          <Card>
            <CardHeader
              step="B"
              title="Score the inventory"
              description="Runs the deterministic scoring engine against every uploaded domain using the active config. Same brief + same inventory + same config always produces the same shortlist."
            />
            <CardBody>
              {isStaleLock && (
                <div className="mb-3 rounded-md border border-border-subtle bg-bg-input/40 px-3 py-2 text-xs text-fg-muted">
                  The previous scoring run didn&rsquo;t finish (it likely hit the
                  function time limit) and was cleared. It&rsquo;s safe to run
                  scoring again — your selections are preserved.
                </div>
              )}
              <ScoreButton campaignId={id} label="Run scoring" />
            </CardBody>
          </Card>
        </section>
      )}

      {/* ---------- Shortlist ---------- */}
      {isScored && (
        <>
          <section className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-fg-strong">
                Shortlist
              </h2>
              <p className="mt-0.5 text-sm text-fg-muted">
                {formatNumber(qualifiedCount)} qualified ·{" "}
                {formatNumber(disqualifiedCount)} disqualified
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ScoreButton campaignId={id} label="Re-score" variant="secondary" />
            </div>
          </section>

          <Shortlist
            campaignId={id}
            campaignName={campaign.name}
            brief={{
              budgetPerLink: brief.budgetPerLink,
              linkCountGoal: brief.linkCountGoal,
            }}
            rows={shortlistRows}
            totalQualified={qualifiedCount}
            totalDisqualified={disqualifiedCount}
            configVersion={campaign.configVersion?.versionNumber ?? 0}
          />
        </>
      )}

      {/* Danger zone — bottom of the page, deliberately small + inline so
          it doesn't compete with the primary workflow controls. */}
      <section className="mt-12 border-t border-border-subtle pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Danger zone
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              Permanently delete this campaign and everything it owns
              (inventory rows, scores, selections). Cannot be undone.
            </p>
          </div>
          <DeleteCampaignButton
            campaignId={id}
            campaignName={campaign.name}
          />
        </div>
      </section>
    </main>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="text-right font-medium text-fg-default">{children}</dd>
    </>
  );
}
