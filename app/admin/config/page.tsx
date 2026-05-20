import Link from "next/link";
import { Plus } from "lucide-react";

import { ActivateConfigButton } from "@/components/activate-config-button";
import { BackLink } from "@/components/ui/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatNumber } from "@/lib/utils";

export const metadata = {
  title: "Scoring Config — Domain Selector",
};

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  const active = await prisma.activeConfig.findUnique({
    where: { id: "singleton" },
    include: { configVersion: true },
  });

  const versions = await prisma.configVersion.findMany({
    orderBy: { versionNumber: "desc" },
    include: {
      _count: { select: { campaigns: true } },
    },
  });

  const activeVersionId = active?.configVersionId ?? null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <nav className="mb-4">
        <BackLink href="/">Back to campaigns</BackLink>
      </nav>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn-soft px-3 py-1 text-xs uppercase tracking-wider text-warn">
            Admin
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-fg-strong">
            Scoring Configuration
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">
            Versioned snapshots of the reasoning layer — weights, caps,
            disqualifier rules, industry profiles, LLM prompt slots. Each
            campaign records the exact version it was scored against, so
            switching the active version never breaks historical
            reproducibility.
          </p>
        </div>
        <Link href="/admin/config/new">
          <Button size="lg">
            <Plus className="h-4 w-4" aria-hidden />
            New Version
          </Button>
        </Link>
      </header>

      {/* ---------- Active version highlight ---------- */}
      {active && active.configVersion && (
        <section className="mb-8">
          <Card className="border-accent/40 bg-accent-soft/20">
            <CardHeader
              title={`Active — v${active.configVersion.versionNumber}`}
              description={
                active.configVersion.note ??
                "(no changelog note)"
              }
            />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-fg-muted">Activated</dt>
                <dd className="text-right font-medium text-fg-default">
                  {active.activatedAt.toLocaleString()}
                </dd>
                <dt className="text-fg-muted">Created</dt>
                <dd className="text-right font-medium text-fg-default">
                  {active.configVersion.createdAt.toLocaleString()}
                </dd>
              </dl>
              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-accent hover:text-accent-hover">
                  View snapshot JSON
                </summary>
                <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-border-subtle bg-bg-input p-3 text-xs leading-relaxed text-fg-default">
                  <code>
                    {JSON.stringify(active.configVersion.snapshot, null, 2)}
                  </code>
                </pre>
              </details>
            </CardBody>
          </Card>
        </section>
      )}

      {/* ---------- Version history ---------- */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
          Version History ({versions.length})
        </h2>

        {versions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-bg-surface/60 p-10 text-center">
            <p className="text-sm text-fg-muted">
              No ConfigVersion rows yet. Run{" "}
              <code className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs">
                npm run db:seed
              </code>{" "}
              to seed v1.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-subtle bg-bg-elevated text-xs uppercase tracking-wider text-fg-subtle">
                <tr>
                  <th className="px-4 py-3 font-medium">Version</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Campaigns
                  </th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {versions.map((v) => {
                  const isActive = v.id === activeVersionId;
                  return (
                    <tr
                      key={v.id}
                      className={
                        isActive ? "bg-accent-soft/20" : "hover:bg-bg-hover/50"
                      }
                    >
                      <td className="px-4 py-3 font-mono tabular-nums">
                        <span className="font-semibold text-fg-strong">
                          v{v.versionNumber}
                        </span>
                        {isActive && (
                          <Badge tone="success" className="ml-2">
                            Active
                          </Badge>
                        )}
                      </td>
                      <td className="max-w-md px-4 py-3 text-fg-default">
                        {v.note ?? (
                          <span className="text-fg-subtle">
                            (no note)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-fg-muted">
                        {v.createdAt.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-fg-muted">
                        {formatNumber(v._count.campaigns)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isActive && (
                          <ActivateConfigButton
                            versionId={v.id}
                            versionNumber={v.versionNumber}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-fg-subtle">
          Snapshots are immutable — there is no edit or delete. Mistakes
          are corrected by creating a new version. Rollback to a previous
          version is non-destructive.
        </p>
      </section>
    </main>
  );
}
