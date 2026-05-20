import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic"; // single-user app — always show fresh list

const STATUS: Record<
  string,
  { label: string; tone: "neutral" | "accent" | "success" | "warn" }
> = {
  DRAFT: { label: "Brief saved", tone: "neutral" },
  INVENTORY_LOADED: { label: "Inventory loaded", tone: "accent" },
  SCORED: { label: "Shortlist ready", tone: "success" },
  FINALIZED: { label: "Exported", tone: "warn" },
};

export default async function HomePage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      _count: { select: { selections: { where: { included: true } } } },
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10 flex items-end justify-between gap-6">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-surface px-3 py-1 text-xs uppercase tracking-wider text-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            BlueTree · Domain Selector
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-fg-strong">
            Campaigns
          </h1>
          <p className="mt-2 max-w-xl text-sm text-fg-muted">
            Score publisher domains from vendor inventory against a client
            brief. Build the shortlist, then export the BlueTree CM workbook.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/config"
            className="text-xs font-medium text-fg-muted transition-colors hover:text-accent"
          >
            Admin · Config →
          </Link>
          <Link href="/campaigns/new">
            <Button size="lg">+ New campaign</Button>
          </Link>
        </div>
      </header>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-default bg-bg-surface/60 p-16 text-center">
          <p className="text-base text-fg-default">No campaigns yet.</p>
          <p className="mt-1 text-sm text-fg-muted">
            Create one to capture a client brief and start scoring.
          </p>
          <Link href="/campaigns/new" className="mt-6 inline-block">
            <Button>Create your first campaign</Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle bg-bg-elevated text-xs uppercase tracking-wider text-fg-subtle">
              <tr>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Profile</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Selected</th>
                <th className="px-5 py-3 font-medium">Updated</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {campaigns.map((c) => {
                const status = STATUS[c.status] ?? {
                  label: c.status,
                  tone: "neutral" as const,
                };
                return (
                  <tr
                    key={c.id}
                    className="transition-colors hover:bg-bg-hover/60"
                  >
                    <td className="px-5 py-4 font-medium text-fg-strong">
                      {c.name}
                    </td>
                    <td className="px-5 py-4 text-xs uppercase tracking-wide text-fg-muted">
                      {c.industryProfile.replace("_", " ")}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-fg-default">
                      {c._count.selections}
                    </td>
                    <td className="px-5 py-4 text-fg-muted">
                      {c.updatedAt.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="text-sm font-medium text-accent hover:text-accent-hover"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
