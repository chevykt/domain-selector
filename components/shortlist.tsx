"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  clearAllSelections,
  toggleSelection,
} from "@/app/actions/toggle-selection";
import { Button } from "@/components/ui/button";
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

export function Shortlist({
  campaignId,
  brief,
  rows,
  totalQualified,
  totalDisqualified,
  configVersion,
}: {
  campaignId: string;
  brief: { budgetPerLink: number; linkCountGoal: number };
  rows: ShortlistRow[];
  totalQualified: number;
  totalDisqualified: number;
  configVersion: number;
}) {
  const router = useRouter();
  const [limit, setLimit] = useState<Limit>(50);
  const [dedupe, setDedupe] = useState(true);
  const [pending, startTransition] = useTransition();
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  const [selections, setSelections] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const r of rows) m[r.domainId] = r.initiallyIncluded;
    return m;
  });

  // BlueTree's vendor CSV often contains the same domain across multiple
  // rows (one per link-type / order-config combo). When dedupe is on we
  // keep only the highest-scoring row per unique domain — preserves the
  // sort order since `rows` is already sorted by score desc.
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

  // ---------- Derived totals ----------
  // Totals always reflect what's visible in the current view, so toggling
  // dedupe gives consistent "what you see is what you count" semantics.
  const visible = dedupedRows.slice(0, limit);
  const selectedAcrossAll = useMemo(
    () => dedupedRows.filter((r) => selections[r.domainId]),
    [dedupedRows, selections]
  );

  const linksSelected = selectedAcrossAll.length;
  const budgetSpent = selectedAcrossAll.reduce(
    (sum, r) => sum + (effectivePrice(r) ?? 0),
    0
  );
  const totalBudget = brief.budgetPerLink * brief.linkCountGoal;
  const budgetRemaining = totalBudget - budgetSpent;
  const avgDR =
    linksSelected > 0
      ? Math.round(
          selectedAcrossAll.reduce(
            (s, r) => s + (r.domainRating ?? 0),
            0
          ) / linksSelected
        )
      : 0;

  return (
    <div className="space-y-4">
      {/* ---------- Over-budget banner ---------- */}
      {budgetRemaining < 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          <span aria-hidden className="mt-0.5 text-base leading-none">
            ⚠
          </span>
          <div>
            <strong className="font-semibold">
              Over budget by {formatCurrency(Math.abs(budgetRemaining))}.
            </strong>{" "}
            <span className="opacity-90">
              {linksSelected} selected domain{linksSelected === 1 ? "" : "s"}{" "}
              cost {formatCurrency(budgetSpent)} vs your{" "}
              {formatCurrency(totalBudget)} budget (
              {brief.linkCountGoal} links × {formatCurrency(brief.budgetPerLink)}).
              Deselect higher-priced rows or revise the brief.
            </span>
          </div>
        </div>
      )}

      {/* ---------- Metric strip ---------- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="Qualified" value={formatNumber(totalQualified)} />
        <Metric
          label="Selected"
          value={`${linksSelected} / ${brief.linkCountGoal}`}
          tone={
            linksSelected >= brief.linkCountGoal ? "success" : undefined
          }
        />
        <Metric
          label="Budget spent"
          value={formatCurrency(budgetSpent)}
          sub={`of ${formatCurrency(totalBudget)}`}
        />
        <Metric
          label="Remaining"
          value={formatCurrency(budgetRemaining)}
          tone={budgetRemaining < 0 ? "danger" : undefined}
        />
        <Metric
          label="Avg DR (selected)"
          value={avgDR > 0 ? String(avgDR) : "—"}
        />
      </div>

      {/* ---------- Controls ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="text-fg-muted">Showing top</span>
          <div className="inline-flex overflow-hidden rounded-md border border-border-default bg-bg-surface p-0.5 text-xs">
            {LIMIT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setLimit(n)}
                className={cn(
                  "rounded px-3 py-1 transition-colors",
                  limit === n
                    ? "bg-accent font-medium text-accent-fg"
                    : "text-fg-muted hover:bg-bg-hover hover:text-fg-default"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="text-xs text-fg-subtle">
            config v{configVersion}
          </span>

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
              disabled={pending}
            >
              Deselect all
            </Button>
          )}
          <Link
            href={`/campaigns/${campaignId}/excluded`}
            className="text-xs font-medium text-accent hover:text-accent-hover"
          >
            Excluded ({formatNumber(totalDisqualified)}) →
          </Link>
        </div>
      </div>

      {/* ---------- Table ---------- */}
      <div className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border-subtle bg-bg-elevated text-xs uppercase tracking-wider text-fg-subtle">
            <tr>
              <Th className="w-10" />
              <Th className="w-10 text-right">#</Th>
              <Th>Domain</Th>
              <Th className="w-24 text-right">Score</Th>
              <Th className="w-14 text-right">DR</Th>
              <Th className="w-24 text-right">Traffic</Th>
              <Th className="w-14 text-center">Geo</Th>
              <Th className="w-28 text-right">Price</Th>
              <Th className="w-16">TAT</Th>
              <Th className="w-16">Link</Th>
              <Th>Contact</Th>
              <Th>Flags</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {visible.map((r, idx) => {
              const checked = !!selections[r.domainId];
              const isExpanded = expandedDomain === r.domainId;
              const price = effectivePrice(r);
              const priceType = effectivePriceType(r);
              return (
                <Fragment key={r.domainId}>
                  <tr
                    onClick={() =>
                      setExpandedDomain(isExpanded ? null : r.domainId)
                    }
                    className={cn(
                      "cursor-pointer transition-colors",
                      checked
                        ? "bg-accent-soft/40"
                        : "hover:bg-bg-hover/50"
                    )}
                  >
                    <td
                      className="px-3 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setIncluded(r.domainId, e.target.checked)
                        }
                        className="h-4 w-4 cursor-pointer accent-accent"
                      />
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-fg-subtle">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-3 font-medium text-fg-strong">
                      {r.domain}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <ScoreBadge total={r.total} max={r.maxPossible} />
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-fg-default">
                      {r.domainRating ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-fg-default">
                      {formatNumber(r.traffic)}
                    </td>
                    <td className="px-3 py-3 text-center text-xs uppercase tracking-wider text-fg-muted">
                      {r.geo ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {price === null ? (
                        <span className="text-fg-subtle">—</span>
                      ) : (
                        <span className="text-fg-default">
                          {formatCurrency(price)}
                          {priceType && (
                            <span className="ml-1 text-xs text-fg-subtle">
                              {priceType}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-fg-muted">
                      {r.tat ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-fg-muted">
                      {r.linkType ?? "—"}
                    </td>
                    <td className="max-w-xs truncate px-3 py-3 text-xs text-fg-muted">
                      {r.contactEmail ?? "—"}
                    </td>
                    <td className="max-w-[200px] px-3 py-3 text-xs">
                      {r.redFlags.length > 0 ? (
                        <span className="text-warn">
                          {r.redFlags.join(", ")}
                        </span>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-bg-input/50">
                      <td colSpan={12} className="px-6 py-4">
                        <div className="mb-3 text-sm text-fg-default">
                          {r.reasoning}
                        </div>
                        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          {Object.entries(r.breakdown).map(([key, d]) => (
                            <div
                              key={key}
                              className="rounded-md border border-border-subtle bg-bg-surface px-3 py-2"
                            >
                              <div className="flex items-baseline justify-between">
                                <dt className="text-fg-muted">{key}</dt>
                                <dd className="font-mono font-semibold text-fg-strong tabular-nums">
                                  {d.score}/{d.cap}
                                </dd>
                              </div>
                              <div className="mt-0.5 text-[11px] text-fg-subtle">
                                {d.detail}
                              </div>
                            </div>
                          ))}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {dedupedRows.length > limit && (
        <p className="text-xs text-fg-subtle">
          Showing top {limit} of {formatNumber(dedupedRows.length)}{" "}
          {dedupe ? "unique " : ""}domains loaded.
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
    </div>
  );
}

// ---------- helpers ----------

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
    <th className={cn("px-3 py-3 font-medium", className)}>{children}</th>
  );
}

function ScoreBadge({ total, max }: { total: number; max: number }) {
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
        "inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
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
      <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
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
