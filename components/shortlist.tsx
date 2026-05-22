"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Mail } from "lucide-react";

import {
  clearAllSelections,
  toggleSelection,
} from "@/app/actions/toggle-selection";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/export-button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export interface ShortlistRow {
  domainId: string;
  domain: string;
  total: number;
  maxPossible: number;
  reasoning: string;
  breakdown: Record<
    string,
    { score: number; cap: number; detail: string }
  >;
  domainRating: number | null;
  traffic: number | null;
  geo: string | null;
  gpPrice: number | null;
  liPrice: number | null;
  isFree: boolean;
  tat: string | null;
  linkType: string | null;
  contactEmail: string | null;
  redFlags: string[];
  initiallyIncluded: boolean;
}

const LIMIT_OPTIONS = [25, 50, 100] as const;
type Limit = (typeof LIMIT_OPTIONS)[number];

const DIMENSION_LABEL: Record<string, string> = {
  nicheMatch: "Niche match",
  domainRating: "Domain rating",
  traffic: "Traffic",
  priceEfficiency: "Price efficiency",
  rankingBonus: "Ranking bonus",
  geoMatch: "Geo match",
  noRedFlags: "No red flags",
};

export function Shortlist({
  campaignId,
  campaignName,
  brief,
  rows,
  totalQualified,
  totalDisqualified,
  configVersion,
}: {
  campaignId: string;
  campaignName: string;
  brief: { budgetPerLink: number; linkCountGoal: number };
  rows: ShortlistRow[];
  totalQualified: number;
  totalDisqualified: number;
  configVersion: number;
}) {
  const router = useRouter();
  const [limit, setLimit] = useState<Limit>(50);
  const [dedupe, setDedupe] = useState(true);
  const [, startTransition] = useTransition();

  // ID of the row whose detail Sheet is open. null = closed.
  const [openDomainId, setOpenDomainId] = useState<string | null>(null);

  const [selections, setSelections] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const r of rows) m[r.domainId] = r.initiallyIncluded;
    return m;
  });

  // Vendor CSV duplicates: keep only the highest-scoring row per unique domain.
  const dedupedRows = useMemo(() => {
    if (!dedupe) return rows;
    const seen = new Map<string, ShortlistRow>();
    const out: ShortlistRow[] = [];
    for (const r of rows) {
      const key = r.domain.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, r);
        out.push(r);
      }
    }
    return out;
  }, [rows, dedupe]);

  const hiddenDuplicateCount = rows.length - dedupedRows.length;

  function setIncluded(domainId: string, included: boolean) {
    setSelections((prev) => ({ ...prev, [domainId]: included }));
    startTransition(async () => {
      const result = await toggleSelection(campaignId, domainId, included);
      if (!result.ok) {
        setSelections((prev) => ({ ...prev, [domainId]: !included }));
      }
    });
  }

  function deselectAll() {
    setSelections({});
    startTransition(async () => {
      await clearAllSelections(campaignId);
      router.refresh();
    });
  }

  // Totals (what-you-see-is-what-you-export)
  const visible = dedupedRows.slice(0, limit);
  const allSelections = useMemo(
    () => rows.filter((r) => selections[r.domainId]),
    [rows, selections]
  );
  const visibleSelections = useMemo(
    () => dedupedRows.filter((r) => selections[r.domainId]),
    [dedupedRows, selections]
  );
  const hiddenSelectedCount =
    allSelections.length - visibleSelections.length;
  const linksSelected = visibleSelections.length;
  const budgetSpent = visibleSelections.reduce(
    (sum, r) => sum + (effectivePrice(r) ?? 0),
    0
  );
  const totalBudget = brief.budgetPerLink * brief.linkCountGoal;
  const budgetRemaining = totalBudget - budgetSpent;
  const avgDR =
    linksSelected > 0
      ? Math.round(
          visibleSelections.reduce(
            (s, r) => s + (r.domainRating ?? 0),
            0
          ) / linksSelected
        )
      : 0;
  const visibleSelectedIds = visibleSelections.map((r) => r.domainId);

  const openRow = openDomainId
    ? dedupedRows.find((r) => r.domainId === openDomainId) ?? null
    : null;

  return (
    <div className="space-y-4">
      {/* Over-budget banner */}
      {budgetRemaining < 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <strong className="font-semibold">
              Over budget by {formatCurrency(Math.abs(budgetRemaining))}.
            </strong>{" "}
            <span className="opacity-90">
              {linksSelected} selected domain
              {linksSelected === 1 ? "" : "s"} cost{" "}
              {formatCurrency(budgetSpent)} vs your{" "}
              {formatCurrency(totalBudget)} budget ({brief.linkCountGoal} links
              × {formatCurrency(brief.budgetPerLink)}). Deselect higher-priced
              rows or revise the brief.
            </span>
          </div>
        </div>
      )}

      {/* Hidden-selection notice */}
      {hiddenSelectedCount > 0 && (
        <div className="rounded-lg border border-warn/40 bg-warn-soft px-4 py-2 text-xs text-warn">
          <strong className="font-semibold">
            {hiddenSelectedCount} selected{" "}
            {hiddenSelectedCount === 1 ? "row is" : "rows are"} hidden by
            dedupe.
          </strong>{" "}
          They&apos;re excluded from the totals and the export. Turn off{" "}
          <em>Dedupe by domain</em> to view and manage them.
        </div>
      )}

      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="Qualified" value={formatNumber(totalQualified)} />
        <Metric
          label="Selected"
          value={`${linksSelected} / ${brief.linkCountGoal}`}
          tone={linksSelected >= brief.linkCountGoal ? "success" : undefined}
        />
        <Metric
          label="Budget Spent"
          value={formatCurrency(budgetSpent)}
          sub={`of ${formatCurrency(totalBudget)}`}
        />
        <Metric
          label="Remaining"
          value={formatCurrency(budgetRemaining)}
          tone={budgetRemaining < 0 ? "danger" : undefined}
        />
        <Metric
          label="Avg DR (Selected)"
          value={avgDR > 0 ? String(avgDR) : "—"}
        />
      </div>

      {/* Controls — sticky so the limit selector + Export remain reachable
          when the user scrolls down through 50-100 rows. Frosted-glass
          background sits above the scrolling table behind it. */}
      <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default bg-bg-surface/95 px-4 py-2.5 text-sm shadow-lg backdrop-blur supports-[backdrop-filter]:bg-bg-surface/80">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-fg-muted">Showing top</span>
          <div className="inline-flex overflow-hidden rounded-md border border-border-default bg-bg-surface p-0.5 text-xs">
            {LIMIT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLimit(n)}
                className={cn(
                  "cursor-pointer rounded px-3 py-1 transition-colors",
                  limit === n
                    ? "bg-accent font-medium text-accent-fg"
                    : "text-fg-muted hover:bg-bg-hover hover:text-fg-default"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="text-xs text-fg-subtle">config v{configVersion}</span>
          <label
            className="inline-flex cursor-pointer items-center gap-2 text-xs text-fg-muted hover:text-fg-default"
            title="Vendor CSV often lists the same domain multiple times (one row per link-type or order-config). When on, only the highest-scoring row per unique domain is shown."
          >
            <input
              type="checkbox"
              checked={dedupe}
              onChange={(e) => setDedupe(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-accent"
            />
            Dedupe by domain
            {hiddenDuplicateCount > 0 && dedupe && (
              <span className="text-fg-subtle">
                ({hiddenDuplicateCount} hidden)
              </span>
            )}
          </label>
        </div>

        <div className="flex items-center gap-3">
          {linksSelected > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={deselectAll}
            >
              Deselect all
            </Button>
          )}
          <Link
            href={`/campaigns/${campaignId}/excluded`}
            className="text-xs font-medium text-accent transition-colors hover:text-accent-hover"
          >
            Excluded ({formatNumber(totalDisqualified)}) →
          </Link>
          <ExportButton
            campaignId={campaignId}
            campaignName={campaignName}
            selectedCount={linksSelected}
            domainIds={visibleSelectedIds}
          />
        </div>
      </div>

      {/* High-density data grid */}
      <div className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border-subtle bg-bg-elevated text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
            <tr>
              <Th className="w-10" />
              <Th className="w-10 text-right">#</Th>
              <Th>Domain</Th>
              <Th className="w-24 text-right">Score</Th>
              <Th className="w-14 text-right">DR</Th>
              <Th className="w-24 text-right">Traffic</Th>
              <Th className="w-12 text-center">Geo</Th>
              <Th className="w-24 text-right">Price</Th>
              <Th className="w-16">TAT</Th>
              <Th className="w-14">Link</Th>
              <Th className="w-40">Flags</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {visible.map((r, idx) => {
              const checked = !!selections[r.domainId];
              const price = effectivePrice(r);
              const priceType = effectivePriceType(r);
              return (
                <tr
                  key={r.domainId}
                  onClick={() => setOpenDomainId(r.domainId)}
                  className={cn(
                    "group cursor-pointer transition-colors",
                    checked
                      ? "bg-accent-soft/30 hover:bg-accent-soft/40"
                      : "hover:bg-bg-hover/60"
                  )}
                >
                  <td
                    className="px-3 py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setIncluded(r.domainId, e.target.checked)
                      }
                      aria-label={`Select ${r.domain}`}
                      className="h-4 w-4 cursor-pointer accent-accent"
                    />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-fg-subtle">
                    {idx + 1}
                  </td>
                  <td className="min-w-0 px-3 py-2">
                    <div className="truncate font-medium text-fg-strong">
                      {r.domain}
                    </div>
                    {/* Inline reasoning — spec requires breakdown visible per row.
                       Click row for full per-dimension drill-down in the Sheet. */}
                    <div
                      className="mt-0.5 truncate text-[11px] text-fg-muted"
                      title={r.reasoning}
                    >
                      {r.reasoning}
                    </div>
                    {r.contactEmail && (
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-fg-subtle">
                        <Mail className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">{r.contactEmail}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ScoreBadge total={r.total} max={r.maxPossible} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-fg-default">
                    {r.domainRating ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-fg-default">
                    {formatNumber(r.traffic)}
                  </td>
                  <td className="px-2 py-2 text-center text-[11px] uppercase tracking-wider text-fg-muted">
                    {r.geo ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {price === null ? (
                      <span className="text-fg-subtle">—</span>
                    ) : (
                      <>
                        <span className="text-fg-default">
                          {formatCurrency(price)}
                        </span>
                        {priceType && (
                          <span className="ml-1 text-[11px] text-fg-subtle">
                            {priceType}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs text-fg-muted">
                    {r.tat ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-xs text-fg-muted">
                    {r.linkType ?? "—"}
                  </td>
                  <td className="max-w-[180px] px-2 py-2 text-xs">
                    {r.redFlags.length > 0 ? (
                      <div className="flex items-start gap-1 text-warn">
                        <AlertTriangle
                          className="mt-0.5 h-3 w-3 shrink-0"
                          aria-hidden
                        />
                        <span
                          className="truncate"
                          title={r.redFlags.join(", ")}
                        >
                          {r.redFlags.join(", ")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-input/40 transition-colors",
                        "group-hover:border-accent group-hover:bg-accent-soft group-hover:text-accent",
                        "text-fg-muted"
                      )}
                      aria-hidden
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                    <span className="sr-only">Open details for {r.domain}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {dedupedRows.length > limit && (
        <p className="text-xs text-fg-subtle">
          Showing top {limit} of {formatNumber(dedupedRows.length)}
          {dedupe ? " unique" : ""} domains loaded.
          {totalQualified > rows.length && (
            <>
              {" "}
              {formatNumber(totalQualified)} qualified in total; top{" "}
              {formatNumber(rows.length)} are loaded for selection — refine
              the brief if you need to reach lower-ranked domains.
            </>
          )}
          {dedupe && hiddenDuplicateCount > 0 && (
            <>
              {" "}
              {hiddenDuplicateCount} duplicate row
              {hiddenDuplicateCount === 1 ? "" : "s"} hidden — turn off Dedupe
              to see them.
            </>
          )}
        </p>
      )}

      {/* Row detail Sheet */}
      <Sheet
        open={openDomainId !== null}
        onOpenChange={(open) => {
          if (!open) setOpenDomainId(null);
        }}
      >
        {openRow && (
          <SheetContent>
            <SheetHeader
              title={openRow.domain}
              description={openRow.reasoning}
            />
            <SheetBody className="space-y-6">
              {/* Score summary */}
              <div className="flex items-center gap-4">
                <ScoreBadge
                  total={openRow.total}
                  max={openRow.maxPossible}
                  size="lg"
                />
                <div className="text-sm text-fg-muted">
                  {Math.round(
                    (openRow.total / Math.max(1, openRow.maxPossible)) * 100
                  )}
                  % of max under this profile
                </div>
              </div>

              {/* Per-dimension breakdown */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  Per-Dimension Score
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(openRow.breakdown).map(([key, d]) => (
                    <div
                      key={key}
                      className="rounded-md border border-border-subtle bg-bg-input/60 px-3 py-2.5"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs text-fg-muted">
                          {DIMENSION_LABEL[key] ?? key}
                        </span>
                        <span className="font-mono text-sm font-semibold tabular-nums text-fg-strong">
                          {d.score}
                          <span className="text-fg-subtle">/{d.cap}</span>
                        </span>
                      </div>
                      {/* Mini bar */}
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-base">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{
                            width: `${d.cap > 0 ? (d.score / d.cap) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-fg-muted">
                        {d.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Metadata grid */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  Domain Metadata
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <Meta label="DR">{openRow.domainRating ?? "—"}</Meta>
                  <Meta label="Traffic">{formatNumber(openRow.traffic)}</Meta>
                  <Meta label="Geo">{openRow.geo ?? "—"}</Meta>
                  <Meta label="Link type">{openRow.linkType ?? "—"}</Meta>
                  <Meta label="TAT">{openRow.tat ?? "—"}</Meta>
                  <Meta label="GP price">
                    {openRow.gpPrice !== null
                      ? formatCurrency(openRow.gpPrice)
                      : "—"}
                  </Meta>
                  <Meta label="LI price">
                    {openRow.liPrice !== null
                      ? formatCurrency(openRow.liPrice)
                      : "—"}
                  </Meta>
                  <Meta label="Free?">
                    {openRow.isFree ? "Yes" : "No"}
                  </Meta>
                </dl>
              </section>

              {/* Contact */}
              {openRow.contactEmail && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                    Contact
                  </h3>
                  <a
                    href={`mailto:${openRow.contactEmail}`}
                    className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-bg-input/60 px-3 py-2 text-sm text-fg-default transition-colors hover:border-accent hover:text-accent"
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                    {openRow.contactEmail}
                  </a>
                </section>
              )}

              {/* Red flags */}
              {openRow.redFlags.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                    Red Flags
                  </h3>
                  <ul className="space-y-1">
                    {openRow.redFlags.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 rounded-md border border-warn/30 bg-warn-soft/40 px-3 py-1.5 text-sm text-warn"
                      >
                        <AlertTriangle
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          aria-hidden
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </SheetBody>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}

/* ============================================================================
   helpers
   ============================================================================ */

function effectivePrice(r: ShortlistRow): number | null {
  if (r.isFree) return 0;
  if (r.gpPrice !== null) return r.gpPrice;
  if (r.liPrice !== null) return r.liPrice;
  return null;
}

function effectivePriceType(r: ShortlistRow): string | null {
  if (r.gpPrice !== null) return "GP";
  if (r.liPrice !== null) return "LI";
  return null;
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={cn("px-3 py-2.5", className)}>{children}</th>
  );
}

function ScoreBadge({
  total,
  max,
  size = "sm",
}: {
  total: number;
  max: number;
  size?: "sm" | "lg";
}) {
  const pct = max > 0 ? total / max : 0;
  const tone =
    pct >= 0.85
      ? "bg-success-soft text-success"
      : pct >= 0.65
        ? "bg-accent-soft text-accent"
        : pct >= 0.4
          ? "bg-warn-soft text-warn"
          : "bg-bg-hover text-fg-muted";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-mono font-semibold tabular-nums",
        size === "lg" ? "px-3 py-1 text-base" : "px-2 py-0.5 text-xs",
        tone
      )}
    >
      {total}
      <span className="text-fg-subtle">/{max}</span>
    </span>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "danger"
            ? "text-danger"
            : tone === "success"
              ? "text-success"
              : "text-fg-strong"
        )}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-fg-subtle">{sub}</div>}
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right font-medium text-fg-default">{children}</dd>
    </>
  );
}
