import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/utils";

const REASON_TONE: Record<
  string,
  "neutral" | "accent" | "success" | "warn" | "danger"
> = {
  DR_BELOW_MIN: "warn",
  TRAFFIC_BELOW_MIN: "warn",
  NOFOLLOW_REJECTED: "neutral",
  BAD_RANKING: "danger",
  EXCLUDED_NICHE: "danger",
  COMPETITOR_BLOCKED: "danger",
  LINK_TYPE_MISMATCH: "neutral",
};

const REASON_LABEL: Record<string, string> = {
  DR_BELOW_MIN: "Low DR",
  TRAFFIC_BELOW_MIN: "Low traffic",
  NOFOLLOW_REJECTED: "Nofollow",
  BAD_RANKING: "Bad ranking",
  EXCLUDED_NICHE: "Excluded niche",
  COMPETITOR_BLOCKED: "Blocklisted",
  LINK_TYPE_MISMATCH: "Wrong link type",
};

export default async function ExcludedPage(
  props: PageProps<"/campaigns/[id]/excluded">
) {
  const { id } = await props.params;

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) notFound();

  const excluded = await prisma.score.findMany({
    where: { campaignId: id, disqualified: true },
    orderBy: { computedAt: "asc" },
    include: { domain: true },
  });

  // Build a reason-code → count map for the summary strip
  const reasonCounts = new Map<string, number>();
  for (const s of excluded) {
    for (const r of s.disqualifierReasons) {
      const code = r.split(":")[0]?.trim();
      if (!code) continue;
      reasonCounts.set(code, (reasonCounts.get(code) ?? 0) + 1);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <nav className="mb-4 text-sm">
        <Link
          href={`/campaigns/${id}`}
          className="text-fg-muted transition-colors hover:text-fg-strong"
        >
          ← Back to campaign
        </Link>
      </nav>

      <header className="mb-6">
        <div className="mb-2 text-xs uppercase tracking-wider text-fg-subtle">
          {campaign.name} · excluded domains
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-fg-strong">
          {formatNumber(excluded.length)} disqualified
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Every domain that failed at least one hard rule. Use this view to
          audit the filter against the brief.
        </p>
      </header>

      {reasonCounts.size > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {Array.from(reasonCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([code, count]) => (
              <Badge key={code} tone={REASON_TONE[code] ?? "neutral"}>
                {REASON_LABEL[code] ?? code} · {count}
              </Badge>
            ))}
        </div>
      )}

      {excluded.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-default bg-bg-surface/60 p-16 text-center">
          <p className="text-sm text-fg-muted">
            No disqualified domains for this campaign.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle bg-bg-elevated text-xs uppercase tracking-wider text-fg-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 text-right font-medium">DR</th>
                <th className="px-4 py-3 text-right font-medium">Traffic</th>
                <th className="px-4 py-3 font-medium">Link Type</th>
                <th className="px-4 py-3 font-medium">Ranking</th>
                <th className="px-4 py-3 font-medium">Reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {excluded.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-bg-hover/60">
                  <td className="px-4 py-3 font-medium text-fg-default">
                    {s.domain.domain}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg-muted">
                    {s.domain.domainRating ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg-muted">
                    {formatNumber(s.domain.traffic)}
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-muted">
                    {s.domain.linkType ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-fg-muted">
                    {s.domain.ranking ?? "—"}
                  </td>
                  <td className="max-w-xl px-4 py-3 text-xs text-danger">
                    {s.disqualifierReasons.join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
